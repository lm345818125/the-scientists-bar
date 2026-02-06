(function () {
  const cfg = window.THE_SCIENTISTS_CONFIG || {};
  const endpoint = (cfg.ORDER_ENDPOINT || "").trim();

  const form = document.getElementById("orderForm");
  const guestEl = document.getElementById("guest");
  const drinkEl = document.getElementById("drink");
  const statusEl = document.getElementById("status");

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

    toggleOpenBtn.textContent = isOpen ? "Close bar" : "Open bar";

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

  // Host controls (initial + when URL hash changes)
  renderHostControls();
  window.addEventListener("hashchange", () => {
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

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Order failed (${res.status}). ${text}`);
    }
    return true;
  }

  function fallbackSend(payload) {
    // Simple fallback: opens the user’s SMS app (works on most phones).
    // You can change to mailto: or a dedicated messaging link later.
    const msg = `the scientists order: ${payload.guest} — ${payload.drink}`;
    // Put your number here later if you want: sms:+12166472995
    window.location.href = `sms:?&body=${encodeURIComponent(msg)}`;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!getBarOpen()) {
      setStatus("Bar is closed.");
      return;
    }

    const guest = guestEl.value.trim();
    const drink = drinkEl.value.trim();
    if (!guest || !drink) return;

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
  });
})();
