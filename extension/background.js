// FocusGuard AI — Background Service Worker
const API_BASE = "http://localhost:8000";

chrome.alarms.create("focusCheck", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "focusCheck") {
    checkFocusStatus();
  }
});

async function checkFocusStatus() {
  const { userEmail } = await chrome.storage.local.get("userEmail");
  if (!userEmail) {
    // Try to read from a shared key set by the web app via postMessage or storage
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/focus/active/${userEmail}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) return;
    const data = await res.json();

    if (data && data.is_active) {
      await activateFocusMode(data);
    } else {
      await clearFocusMode();
    }
  } catch (err) {
    console.error("FocusGuard: failed to check focus status", err);
  }
}

async function activateFocusMode(session) {
  const { lastSessionId } = await chrome.storage.local.get("lastSessionId");

  if (lastSessionId !== session.session_id) {
    chrome.notifications.create(`focus-${session.session_id}`, {
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "🛡️ Focus Mode Active",
      message: `Focusing for: ${session.event_title}`,
    });
    await chrome.storage.local.set({ lastSessionId: session.session_id });
  }

  await chrome.storage.local.set({ activeSession: session });

  // Block all listed domains, skipping emergency sites
  const emergencySites = new Set(session.emergency_sites || []);
  const rules = (session.blocked_sites || [])
    .filter((domain) => !emergencySites.has(domain))
    .map((domain, index) => ({
      id: index + 1,
      priority: 1,
      action: {
        type: "redirect",
        redirect: { extensionPath: "/blocked.html" },
      },
      condition: {
        urlFilter: `||${domain}^`,
        resourceTypes: ["main_frame"],
      },
    }));

  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existingRules.map((r) => r.id);

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules: rules,
  });
}

async function clearFocusMode() {
  await chrome.storage.local.set({ activeSession: null });
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  if (existingRules.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRules.map((r) => r.id),
      addRules: [],
    });
  }
}

// Listen for messages from the popup or blocked page
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "SET_USER_EMAIL") {
    chrome.storage.local.set({ userEmail: msg.email });
    sendResponse({ ok: true });
  }
  if (msg.type === "FORCE_CHECK") {
    checkFocusStatus().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Run immediately on startup
checkFocusStatus();
