# the scientists — order relay (Option A.5)

This is a tiny local server that accepts public order POSTs (via Tailscale Funnel) and forwards them to OpenClaw hooks.

## Why

- Keeps OpenClaw hook token **off** the public website
- Exposes only a single narrow endpoint (`/gmail-pubsub`)

## Run

```bash
cd the-scientists-bar/order-relay
export ORDER_PUBLIC_TOKEN="<same as config.js ORDER_PUBLIC_TOKEN>"
node server.js
```

Server listens on `127.0.0.1:8800` by default.

## Tailscale Funnel

This relay is designed to **reuse your existing Funnel path**:

- `https://<your-magicdns>.ts.net/gmail-pubsub` → `http://127.0.0.1:8800`

So you typically **don’t need to change** your Tailscale Serve/Funnel config.

(If you later want a prettier URL like `/bar-orders`, we can update the Serve config.)

## Website config

Set in `the-scientists-bar/config.js`:
- `ORDER_ENDPOINT` = that public URL
- `ORDER_PUBLIC_TOKEN` = the same token used to start the relay

The website will send header:
`x-order-token: <ORDER_PUBLIC_TOKEN>`
