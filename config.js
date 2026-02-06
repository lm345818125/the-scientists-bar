// Configure where orders should be sent.
//
// Recommended setup (A.5):
// - Public endpoint (no OpenClaw secrets): ORDER_ENDPOINT
// - A lightweight token embedded in the site: ORDER_PUBLIC_TOKEN
// - Local relay validates ORDER_PUBLIC_TOKEN then forwards to OpenClaw hooks.

window.THE_SCIENTISTS_CONFIG = {
  // Public URL guests will POST to (via Tailscale Funnel -> local relay)
  // NOTE: Reuses your existing Funnel path.
  ORDER_ENDPOINT: "https://meis-macbook-pro.tailfcfed4.ts.net/gmail-pubsub",

  // Lightweight shared token between the website + your local relay.
  // Rotate anytime.
  ORDER_PUBLIC_TOKEN: "t_JKllTXJfkYrmnTZZ9t8c3w2yImcZc6ShYkdb67Va8",

  // Bar availability
  // Guests will see OPEN/CLOSED. When closed, ordering is disabled.
  BAR_OPEN_DEFAULT: true,

  // Host controls
  // Visit the site with:  https://<site>/#host-<PIN>
  // to reveal an Open/Close toggle (stored in this device's localStorage).
  HOST_PIN: "science",
};
