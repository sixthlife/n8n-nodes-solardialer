import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

// The account's API key (SolarDialer → Account → API), sent as a bearer token on every
// request, and checked against /me when the credential is saved.
export class SolarDialerApi implements ICredentialType {
	name = 'solarDialerApi';

	displayName = 'SolarDialer API';

	documentationUrl = 'https://solardialer.net/n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'In SolarDialer, open Account → API and create a key. It starts with sdk_ and is shown once.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: { Authorization: '=Bearer {{$credentials.apiKey}}' },
		},
	};

	test: ICredentialTestRequest = {
		request: { baseURL: 'https://solardialer.net/api/v1', url: '/me' },
	};
}
