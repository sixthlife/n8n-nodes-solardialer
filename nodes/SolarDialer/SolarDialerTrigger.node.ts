import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';
import { NodeConnectionTypes } from 'n8n-workflow';

import { api, apiError } from './SolarDialer.node';

// SolarDialer's webhook events (solardialer.net/api): one subscription per workflow,
// made when it is activated and removed when it is deactivated.
const EVENTS = [
	{ name: 'Call Ended', value: 'call.ended', description: 'A call ends, with its outcome, summary, transcript and recording link' },
	{ name: 'Lead Transferred', value: 'call.transferred', description: 'A lead is transferred to your closer' },
	{ name: 'Lead Interested', value: 'lead.interested', description: 'A lead says they are interested' },
	{ name: 'Callback Booked', value: 'callback.booked', description: 'A lead books a callback' },
	{ name: 'Lead Status Changed', value: 'lead.status_changed', description: 'You give a lead a new status' },
	{ name: 'New Lead', value: 'lead.created', description: 'A lead is added' },
	{ name: 'Campaign Finished', value: 'campaign.finished', description: 'A campaign finishes' },
	{ name: 'Lead Asked Not to Be Called', value: 'lead.removed', description: 'A lead asks not to be called again' },
];

export class SolarDialerTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SolarDialer Trigger',
		name: 'solarDialerTrigger',
		icon: { light: 'file:solardialer.svg', dark: 'file:solardialer.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when SolarDialer ends a call, transfers a lead, books a callback and more',
		defaults: { name: 'SolarDialer Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'solarDialerApi', required: true }],
		webhooks: [{ name: 'default', httpMethod: 'POST', responseMode: 'onReceived', path: 'webhook' }],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				options: EVENTS,
				default: 'call.transferred',
				required: true,
			},
		],
	};

	webhookMethods = {
		default: {
			// Asks SolarDialer, not only this workflow's memory (code review 2026-10-22): a hook
			// removed on its Integrations page, marked failing after its retries, or sent to an
			// older webhook URL left the trigger active with nothing ever arriving.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (!data.hookId) return false;
				let hook: IDataObject;
				try {
					hook = (await api.call(this, 'GET', `/hooks/${data.hookId}`)) as IDataObject;
				} catch (error) {
					const failed = apiError(this.getNode(), error);
					// Unreachable or failing itself: activation stops here, rather than a second hook
					// to the same URL while the first may still be live.
					if (failed.httpCode !== '404') throw failed;
					delete data.hookId;
					return false;
				}
				if (
					!hook.failing &&
					hook.target_url === this.getNodeWebhookUrl('default') &&
					hook.event === this.getNodeParameter('event')
				) {
					return true;
				}
				// Not this node's any more: removed (best effort) before a new one is made.
				try {
					await api.call(this, 'DELETE', `/hooks/${data.hookId}`);
				} catch (error) {
					this.logger.warn(`SolarDialer webhook ${data.hookId} not removed: ${(error as Error).message}`);
				}
				delete data.hookId;
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const made = (await api.call(this, 'POST', '/hooks', {
					event: this.getNodeParameter('event') as string,
					target_url: this.getNodeWebhookUrl('default'),
					source: 'n8n',
				})) as IDataObject;
				if (!made.id) return false;
				this.getWorkflowStaticData('node').hookId = made.id;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				if (data.hookId) {
					try {
						await api.call(this, 'DELETE', `/hooks/${data.hookId}`);
					} catch (error) {
						// Gone already (or SolarDialer unreachable): the workflow is deactivated anyway.
						this.logger.warn(`SolarDialer webhook ${data.hookId} not removed: ${(error as Error).message}`);
					}
					delete data.hookId;
				}
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData() as IDataObject;
		return { workflowData: [this.helpers.returnJsonArray(body)] };
	}
}
