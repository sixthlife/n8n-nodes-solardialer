import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
} from 'n8n-workflow';

import { api } from './SolarDialer.node';

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
		icon: 'file:solardialer.png',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts the workflow when SolarDialer ends a call, transfers a lead, books a callback and more',
		defaults: { name: 'SolarDialer Trigger' },
		inputs: [],
		outputs: ['main'],
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
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const data = this.getWorkflowStaticData('node');
				return Boolean(data.hookId);
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const made = (await api.call(this as never, 'POST', '/hooks', {
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
						await api.call(this as never, 'DELETE', `/hooks/${data.hookId}`);
					} catch {
						// Gone already: nothing to remove.
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
