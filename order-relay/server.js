#!/usr/bin/env node
/**
 * the scientists — order relay (Option A.5)
 *
 * Public internet -> Tailscale Funnel path -> this relay (loopback)
 * Relay validates a lightweight ORDER_PUBLIC_TOKEN, then forwards to OpenClaw hooks.
 *
 * Run:
 *   node server.js
 */

const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOST = process.env.ORDER_RELAY_BIND || '127.0.0.1';
// Default to 8800 so it can reuse the existing Tailscale Funnel path you already have.
// (You previously exposed /gmail-pubsub -> http://127.0.0.1:8800)
const PORT = Number(process.env.ORDER_RELAY_PORT || 8800);

const ORDER_TOKEN = (process.env.ORDER_PUBLIC_TOKEN || '').trim();
if (!ORDER_TOKEN) {
  console.error('Missing ORDER_PUBLIC_TOKEN env var. Refusing to start.');
  process.exit(1);
}

function loadOpenClawConfig() {
  const p = path.join(os.homedir(), '.openclaw', 'openclaw.json');
  const raw = fs.readFileSync(p, 'utf8');
  const cfg = JSON.parse(raw);
  const hooks = cfg.hooks || {};
  const gateway = cfg.gateway || {};

  if (!hooks.enabled || !hooks.token) throw new Error('OpenClaw hooks not enabled or missing hooks.token');

  const port = gateway.port || 18789;
  const basePath = hooks.path || '/hooks';

  return {
    hooksToken: hooks.token,
    wakeUrl: `http://127.0.0.1:${port}${basePath}/wake`,
    agentUrl: `http://127.0.0.1:${port}${basePath}/agent`,
  };
}

const openclaw = loadOpenClawConfig();

// Tiny in-memory rate limiter (best-effort)
const ipHits = new Map();
function rateLimitOk(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 30; // 30 requests/min per IP

  const cur = ipHits.get(ip) || { t: now, n: 0 };
  if (now - cur.t > windowMs) {
    cur.t = now;
    cur.n = 0;
  }
  cur.n += 1;
  ipHits.set(ip, cur);
  return cur.n <= max;
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type, x-order-token',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(body);
}

async function forwardToOpenClaw({ guest, drink }) {
  // Use /hooks/agent so the payload turns into an actual WhatsApp delivery.
  // (/hooks/wake would only enqueue a system event inside the main session.)
  const message = [
    'Send a WhatsApp message to Mei with this exact content (no extra commentary):',
    '',
    'the scientists order',
    `- Guest: ${guest}`,
    `- Drink: ${drink}`,
  ].join('\n');

  const payload = {
    message,
    name: 'BarOrder',
    sessionKey: `hook:bar-order:${Date.now()}`,
    wakeMode: 'now',
    deliver: true,
    channel: 'whatsapp',
    to: '+12166472995',
    thinking: 'low',
    timeoutSeconds: 30,
  };

  const res = await fetch(openclaw.agentUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openclaw.hooksToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!(res.status === 202 || res.ok)) {
    const t = await res.text().catch(() => '');
    throw new Error(`OpenClaw agent failed (${res.status}): ${t}`);
  }
}

function logEvent(obj) {
  try {
    console.log(JSON.stringify({ ts: new Date().toISOString(), ...obj }));
  } catch {
    // ignore
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 50_000) {
        reject(new Error('payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function cleanStr(s, maxLen) {
  return String(s || '').trim().replace(/[\r\n\t]+/g, ' ').slice(0, maxLen);
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return sendJson(res, 200, { ok: true });
  }

  // Tailscale Serve may strip the mounted path prefix when proxying.
  // So we accept both the mounted path and `/`.
  const allowedPaths = ['/', '/bar-orders', '/gmail-pubsub'];

  // Simple reachability check (lets guests verify connectivity in a browser)
  // Note: Funnel is currently mounted at /gmail-pubsub, and Serve may strip prefixes.
  if (req.method === 'GET' && (req.url === '/healthz' || req.url === '/' || req.url === '/gmail-pubsub' || req.url === '/bar-orders')) {
    return sendJson(res, 200, { ok: true, service: 'the-scientists-order-relay' });
  }

  if (req.method !== 'POST' || !allowedPaths.includes(req.url)) {
    return sendJson(res, 404, { ok: false, error: 'not_found' });
  }

  const ip = (req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
  if (!rateLimitOk(ip)) {
    logEvent({ event: 'rate_limited', ip, url: req.url });
    return sendJson(res, 429, { ok: false, error: 'rate_limited' });
  }

  const token = (req.headers['x-order-token'] || '').toString().trim();
  if (token !== ORDER_TOKEN) {
    logEvent({ event: 'unauthorized', ip, url: req.url });
    return sendJson(res, 401, { ok: false, error: 'unauthorized' });
  }

  try {
    const raw = await readBody(req);
    const json = JSON.parse(raw || '{}');

    const guest = cleanStr(json.guest, 40);
    const drink = cleanStr(json.drink, 80);

    if (!guest || !drink) {
      logEvent({ event: 'bad_request', ip, url: req.url, error: 'missing_fields' });
      return sendJson(res, 400, { ok: false, error: 'missing_fields' });
    }

    logEvent({ event: 'order_received', ip, url: req.url, guest, drink });

    await forwardToOpenClaw({ guest, drink });

    logEvent({ event: 'order_forwarded', ip, guest, drink });
    return sendJson(res, 200, { ok: true });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: e.message || 'server_error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`order relay listening on http://${HOST}:${PORT}/(bar-orders|gmail-pubsub)`);
  console.log(`forwarding to OpenClaw agent hook: ${openclaw.agentUrl}`);
});
