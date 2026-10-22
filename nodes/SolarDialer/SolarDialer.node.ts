import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INode,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

export const BASE = 'https://solardialer.net/api/v1';

// The lead's fields, as SolarDialer's Lead API takes them (solardialer.net/api).
const LEAD_FIELDS = [
	{ displayName: 'Last Name', name: 'last_name', type: 'string' as const, default: '' },
	{
		displayName: 'State',
		name: 'state',
		type: 'string' as const,
		default: '',
		description: 'Two letters (PA). Required for US numbers: it decides the calling hours and rules.',
	},
	{ displayName: 'Email', name: 'email', type: 'string' as const, placeholder: 'name@email.com', default: '' },
	{ displayName: 'Address', name: 'address', type: 'string' as const, default: '' },
	{ displayName: 'City', name: 'city', type: 'string' as const, default: '' },
	{ displayName: 'ZIP', name: 'zip', type: 'string' as const, default: '' },
	{ displayName: 'Second Phone', name: 'second_phone', type: 'string' as const, default: '' },
	{
		displayName: 'Your Lead ID',
		name: 'lead_id',
		type: 'string' as const,
		default: '',
		description: 'Your own ID for the lead (e.g. the CRM contact ID). Sending it again updates the lead.',
	},
	{
		displayName: 'List Name or ID',
		name: 'list',
		type: 'options' as const,
		typeOptions: { loadOptionsMethod: 'getLists' },
		default: '',
		description:
			'The list to put it on. Choose from the list, or specify a name using an <a href="https://docs.n8n.io/code/expressions/">expression</a>; a new name makes the list.',
	},
	{
		displayName: 'Campaign Name or ID',
		name: 'campaign_id',
		type: 'options' as const,
		typeOptions: { loadOptionsMethod: 'getCampaigns' },
		default: '',
		description:
			'The campaign to put it in: it goes on that campaign\'s list. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
	},
	{ displayName: 'Source', name: 'source', type: 'string' as const, default: '' },
	{ displayName: 'Notes', name: 'notes', type: 'string' as const, typeOptions: { rows: 3 }, default: '' },
];

export async function api(
	this: IExecuteFunctions | ILoadOptionsFunctions | IHookFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject | IDataObject[]> {
	return (await this.helpers.httpRequestWithAuthentication.call(this, 'solarDialerApi', {
		method,
		url: `${BASE}${path}`,
		body,
		qs,
		json: true,
	})) as IDataObject | IDataObject[];
}

// A failed request as n8n shows it, with the API's own words as its description. The API
// answers every error as {"ok": false, "errors": [text, ...]}; n8n keeps that body in the
// error's context.data (response.data on an unwrapped one), but its message is a generic
// line for the status ("Bad request - please check your parameters") and its description
// often the HTTP client's "Request failed with status code 400" (code review 2026-10-22).
export function apiError(node: INode, error: unknown, itemIndex?: number): NodeApiError {
	const wrapped = new NodeApiError(node, error as JsonObject, itemIndex === undefined ? {} : { itemIndex });
	const body = (wrapped.context?.data ?? (error as { response?: { data?: unknown } })?.response?.data) as
		| IDataObject
		| undefined;
	const errors = body && Array.isArray(body.errors) ? body.errors.filter((e) => typeof e === 'string') : [];
	if (errors.length) wrapped.description = errors.join(' ');
	return wrapped;
}

export class SolarDialer implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SolarDialer',
		name: 'solarDialer',
		icon: { light: 'file:solardialer.svg', dark: 'file:solardialer.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Add leads to SolarDialer, or have its AI agent call them right away',
		defaults: { name: 'SolarDialer' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'solarDialerApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Call Lead Now',
						value: 'call',
						description: 'Create a lead and call it right away',
						action: 'Call a lead now',
					},
					{
						name: 'Create or Update',
						value: 'upsert',
						description: 'Create a new record, or update the current one if it already exists (upsert)',
						action: 'Create or update a lead',
					},
					{
						name: 'Find Lead',
						value: 'find',
						description: 'Find a lead by phone or ID',
						action: 'Find a lead',
					},
				],
				default: 'call',
			},
			{
				displayName: 'First Name',
				name: 'first_name',
				type: 'string',
				required: true,
				default: '',
				displayOptions: { show: { operation: ['call', 'upsert'] } },
			},
			{
				displayName: 'Phone',
				name: 'phone',
				type: 'string',
				required: true,
				default: '',
				description: 'US numbers in any common form; other countries with + and the country code',
				displayOptions: { show: { operation: ['call', 'upsert'] } },
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: { show: { operation: ['call', 'upsert'] } },
				options: LEAD_FIELDS,
			},
			{
				displayName: 'Find By',
				name: 'findBy',
				type: 'options',
				options: [
					{ name: 'Phone', value: 'phone' },
					{ name: 'Lead ID', value: 'lead_id' },
				],
				default: 'phone',
				displayOptions: { show: { operation: ['find'] } },
			},
			{
				displayName: 'Value',
				name: 'findValue',
				type: 'string',
				required: true,
				default: '',
				description: 'Any of the lead\'s numbers, or the ID you sent it with (or SolarDialer\'s own, like u3-W1047)',
				displayOptions: { show: { operation: ['find'] } },
			},
		],
	};

	methods = {
		loadOptions: {
			async getCampaigns(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const found = (await api.call(this, 'GET', '/campaigns')) as IDataObject[];
				return found.map((c) => ({ name: String(c.name), value: String(c.id) }));
			},
			async getLists(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const found = (await api.call(this, 'GET', '/lists')) as IDataObject[];
				return found.map((l) => ({ name: String(l.name), value: String(l.name) }));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];
		for (let i = 0; i < items.length; i++) {
			const operation = this.getNodeParameter('operation', i) as string;
			if (operation === 'find' && !(this.getNodeParameter('findValue', i) as string).trim()) {
				throw new NodeOperationError(this.getNode(), 'Fill in the phone or lead ID.', { itemIndex: i });
			}
			try {
				let result: IDataObject | IDataObject[];
				if (operation === 'find') {
					const by = this.getNodeParameter('findBy', i) as string;
					const value = (this.getNodeParameter('findValue', i) as string).trim();
					result = await api.call(this, 'GET', '/leads', undefined, { [by]: value });
				} else {
					const body: IDataObject = {
						first_name: this.getNodeParameter('first_name', i),
						phone: this.getNodeParameter('phone', i),
					};
					const extra = this.getNodeParameter('additionalFields', i, {}) as IDataObject;
					for (const [k, v] of Object.entries(extra)) {
						if (v !== undefined && v !== null && String(v).trim() !== '') body[k] = v;
					}
					result = await api.call(this, 'POST', operation === 'call' ? '/calls' : '/leads', body);
				}
				for (const row of Array.isArray(result) ? result : [result]) {
					out.push({ json: row, pairedItem: { item: i } });
				}
			} catch (error) {
				const failed = apiError(this.getNode(), error, i);
				if (this.continueOnFail()) {
					// What went wrong in the API's words, not n8n's generic line for the status.
					out.push({ json: { error: failed.description || failed.message }, pairedItem: { item: i } });
					continue;
				}
				throw failed;
			}
		}
		return [out];
	}
}
