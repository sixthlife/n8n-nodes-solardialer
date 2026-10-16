# n8n-nodes-solardialer

[SolarDialer](https://solardialer.net) for [n8n](https://n8n.io): an AI agent that calls your
leads, asks if they're still interested, and live-transfers the interested ones to your closer.

## Install

In n8n: **Settings → Community Nodes → Install**, enter `n8n-nodes-solardialer`, and accept.
(Self-hosted n8n: see [installing community nodes](https://docs.n8n.io/integrations/community-nodes/installation/).)

## Credentials

Create an API key in SolarDialer under **Account → API** (it starts with `sdk_`), then add a
**SolarDialer API** credential in n8n and paste it.

## Nodes

**SolarDialer** (actions)

- **Call Lead Now**: creates a lead and has the agent call it right away (within its legal
  calling hours), transferring it live to your closer if interested.
- **Create or Update Lead**: adds a lead to a list or campaign, or updates the one with the
  same phone or ID.
- **Find Lead**: finds a lead by phone or ID.

**SolarDialer Trigger**

Starts a workflow when a call ends, a lead is transferred, a lead says they're interested, a
callback is booked, a lead's status changes, a lead is added, a campaign finishes, or a lead
asks not to be called. Each event carries the lead and, for calls, the outcome, AI summary,
answers, transcript and recording link.

## Pricing

Free to install. Calls are billed by SolarDialer per minute while connected; unanswered calls
are free. See [solardialer.net/pricing](https://solardialer.net/pricing).

## Support

info@solardialer.net, +1 (689) 220-2019 (call, text or WhatsApp).
