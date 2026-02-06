(function () {
  const cfg = window.THE_SCIENTISTS_CONFIG || {};
  const endpoint = (cfg.ORDER_ENDPOINT || "").trim();

  const form = document.getElementById("orderForm");
  const guestEl = document.getElementById("guest");
  const drinkEl = document.getElementById("drink");
  const statusEl = document.getElementById("status");
  const sendOrderBtn = document.getElementById("sendOrderBtn");

  const openPill = document.getElementById("openPill");
  const hostControls = document.getElementById("hostControls");
  let toggleOpenBtn = document.getElementById("toggleOpenBtn");
  const hostSetupDetails = document.getElementById("hostSetupDetails");

  const STORAGE_KEY = "the-scientists:barOpen";

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function getBarOpen() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return !!cfg.BAR_OPEN_DEFAULT;
    return raw === "true";
  }

  function setBarOpen(next) {
    localStorage.setItem(STORAGE_KEY, String(!!next));
    renderBarState();
  }

  function renderBarState() {
    const isOpen = getBarOpen();

    openPill.textContent = isOpen ? "OPEN" : "CLOSED";
    openPill.classList.toggle("closed", !isOpen);

    // Disable ordering when closed
    document.querySelectorAll(".orderBtn").forEach((btn) => {
      btn.disabled = !isOpen;
      btn.style.opacity = isOpen ? "1" : ".45";
      btn.style.cursor = isOpen ? "pointer" : "not-allowed";
    });

    [...form.querySelectorAll("input, select, button.primary")].forEach((el) => {
      el.disabled = !isOpen;
    });

    if (toggleOpenBtn) toggleOpenBtn.textContent = isOpen ? "Close bar" : "Open bar";

    if (!isOpen) setStatus("Bar is currently closed.");
    else setStatus("");
  }

  function isHostMode() {
    // Host mode is enabled by visiting:  #host-<PIN>
    // Make it resilient: accept case differences and react to hash changes.
    const pin = String(cfg.HOST_PIN || "").trim();
    if (!pin) return false;

    const hash = decodeURIComponent(String(window.location.hash || "")).trim();
    return hash.toLowerCase() === `#host-${pin}`.toLowerCase();
  }

  let hostWired = false;
  function ensureHostButton() {
    if (!hostControls) return null;

    // Don’t keep host UI in the guest DOM. Create it only in host mode.
    if (!toggleOpenBtn) {
      const btn = document.createElement("button");
      btn.className = "ghost";
      btn.id = "toggleOpenBtn";
      btn.type = "button";
      btn.textContent = "Close bar";
      hostControls.appendChild(btn);
      toggleOpenBtn = btn;
    }

    return toggleOpenBtn;
  }

  function renderHostControls() {
    const enabled = isHostMode();

    document.body.classList.toggle("hostMode", enabled);

    if (hostControls) hostControls.hidden = !enabled;
    if (hostSetupDetails) hostSetupDetails.hidden = !enabled;

    if (enabled) {
      const btn = ensureHostButton();
      if (btn && !hostWired) {
        hostWired = true;
        btn.addEventListener("click", () => {
          setBarOpen(!getBarOpen());
        });
      }
    }
  }

  function purgeGuestHostUi() {
    // Defense-in-depth: if an older cached HTML still contains the button,
    // remove it unless we're in host mode.
    if (isHostMode()) return;
    const oldBtn = document.getElementById("toggleOpenBtn");
    if (oldBtn) oldBtn.remove();
  }

  // Host controls (initial + when URL hash changes)
  purgeGuestHostUi();
  renderHostControls();
  window.addEventListener("hashchange", () => {
    purgeGuestHostUi();
    renderHostControls();
  });

  renderBarState();

  // Wire “Order” buttons to preselect drink.
  document.querySelectorAll(".orderBtn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!getBarOpen()) return;

      const name = btn.getAttribute("data-order");
      // select matching option
      [...drinkEl.options].forEach((opt) => {
        if (opt.value === name || opt.textContent === name) {
          drinkEl.value = opt.value || opt.textContent;
        }
      });
      guestEl.focus();
      setStatus(`Selected: ${name}`);
    });
  });

  async function sendToEndpoint(payload) {
    const headers = { "Content-Type": "application/json" };
    const publicToken = String(cfg.ORDER_PUBLIC_TOKEN || "").trim();
    if (publicToken) headers["x-order-token"] = publicToken;

    // Avoid hanging forever if the endpoint is unreachable (common on captive Wi‑Fi).
    const ctrl = new AbortController();
    const timeoutMs = 8000;
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Order failed (${res.status}). ${text}`);
      }

      return true;
    } catch (err) {
      const name = String(err?.name || "");
      const msg = String(err?.message || err || "");
      if (name === "AbortError") {
        throw new Error("Couldn’t reach the bar order server (timeout). Try again, or message the host.");
      }
      // Chrome often reports network/CORS issues as TypeError: Failed to fetch
      if (name === "TypeError" && /failed to fetch/i.test(msg)) {
        throw new Error("Couldn’t reach the bar order server. Check your connection (Wi‑Fi/cellular) and try again.");
      }
      throw err;
    } finally {
      clearTimeout(t);
    }
  }

  function fallbackSend(payload) {
    // Simple fallback: opens the user’s SMS app (works on most phones).
    // You can change to mailto: or a dedicated messaging link later.
    const msg = `the scientists order: ${payload.guest} — ${payload.drink}`;
    // Put your number here later if you want: sms:+12166472995
    window.location.href = `sms:?&body=${encodeURIComponent(msg)}`;
  }

  async function handleSendOrder(e) {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    if (!getBarOpen()) {
      setStatus("Bar is closed.");
      return;
    }

    const guest = guestEl.value.trim();
    const drink = drinkEl.value.trim();
    if (!guest || !drink) {
      setStatus("Please enter your name and select a drink.");
      return;
    }

    const payload = {
      guest,
      drink,
      sourceUrl: window.location.href,
      timestamp: new Date().toISOString(),
    };

    setStatus("Sending…");

    try {
      if (endpoint) {
        await sendToEndpoint(payload);
        setStatus(`Sent. ✅ ${guest} ordered “${drink}”.`);
        form.reset();
      } else {
        setStatus("Opening message…");
        fallbackSend(payload);
      }
    } catch (err) {
      setStatus(err.message || "Something went wrong sending the order.");
    }
  }

  // Clicking the button should never navigate/reload the page.
  if (sendOrderBtn) sendOrderBtn.addEventListener("click", handleSendOrder);

  // Still allow Enter key in inputs to submit.
  form.addEventListener("submit", handleSendOrder);
})();
