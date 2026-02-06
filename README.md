# the scientists — home cocktail bar (MVP)

A one-page, QR-friendly speakeasy menu with glass silhouettes + a simple order form.

## Run locally

If you have Python:

```bash
cd the-scientists-bar
python3 -m http.server 8088
```

Then open: http://localhost:8088

## Orders

- Configure `ORDER_ENDPOINT` in `config.js`.
- The site POSTs JSON:

```json
{
  "guest": "Mei",
  "drink": "Blackbox Negroni",
  "sourceUrl": "https://...",
  "timestamp": "2026-02-03T06:00:00.000Z"
}
```

If no endpoint is set, it falls back to opening an SMS compose screen with a pre-filled order message.

## Bar open / closed

The site supports a simple OPEN/CLOSED mode.

- Default is set in `config.js` (`BAR_OPEN_DEFAULT`).
- To reveal host controls, open the site with:

```
/#host-<PIN>
```

The PIN is `HOST_PIN` in `config.js`. Toggling open/closed is stored in the *current device/browser* via `localStorage`.

## Next step

Wire `ORDER_ENDPOINT` to an OpenClaw webhook that forwards orders to Mei via WhatsApp.
