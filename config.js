// Configure where orders should be sent.
//
// Recommended setup (A.5):
// - Public endpoint (no OpenClaw secrets): ORDER_ENDPOINT
// - A lightweight token embedded in the site: ORDER_PUBLIC_TOKEN
// - Local relay validates ORDER_PUBLIC_TOKEN then forwards to OpenClaw hooks.

window.THE_SCIENTISTS_CONFIG = {
  // Public URL guests will POST to (via Tailscale Funnel -> local relay)
  ORDER_ENDPOINT: "", // e.g. "https://meis-macbook-pro.tailfcfed4.ts.net/bar-orders"

  // Shared secret between the website + your local relay.
  // Rotate anytime.
  ORDER_PUBLIC_TOKEN: "CHANGE-ME",

  // Bar availability
  // Guests will see OPEN/CLOSED. When closed, ordering is disabled.
  BAR_OPEN_DEFAULT: true,

  // Host controls
  // Visit the site with:  https://<site>/#host-<PIN>
  // to reveal an Open/Close toggle (stored in this device's localStorage).
  HOST_PIN: "science",
};
