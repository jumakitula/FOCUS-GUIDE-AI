const card = document.getElementById("statusCard");
const checkBtn = document.getElementById("checkBtn");
const emailRow = document.getElementById("emailRow");
const emailInput = document.getElementById("emailInput");
const saveEmailBtn = document.getElementById("saveEmailBtn");
const connectedEmailEl = document.getElementById("connectedEmail");

function formatCountdown(endTimeStr) {
  const end = new Date(endTimeStr).getTime();
  const now = Date.now();
  const diff = Math.max(0, end - now);
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

let countdownInterval = null;

function renderActive(session) {
  if (countdownInterval) clearInterval(countdownInterval);
  card.innerHTML = `
    <div class="status-label">
      <span class="dot active"></span>Focus Mode Active
    </div>
    <div class="event-name">${session.event_title}</div>
    <div class="countdown" id="countdown">${formatCountdown(session.end_time)}</div>
  `;
  countdownInterval = setInterval(() => {
    const el = document.getElementById("countdown");
    if (el) el.textContent = formatCountdown(session.end_time);
  }, 1_000);
}

function renderInactive() {
  if (countdownInterval) clearInterval(countdownInterval);
  card.innerHTML = `
    <div class="status-label">
      <span class="dot inactive"></span>Inactive
    </div>
    <div class="inactive-text">No focus session active</div>
  `;
}

async function render() {
  const { activeSession, userEmail } = await chrome.storage.local.get([
    "activeSession",
    "userEmail",
  ]);

  // Show/hide email UI
  if (userEmail) {
    connectedEmailEl.textContent = `✓ ${userEmail}`;
    connectedEmailEl.style.display = "block";
    emailRow.style.display = "none";
    checkBtn.style.display = "block";
  } else {
    connectedEmailEl.style.display = "none";
    emailRow.style.display = "flex";
    checkBtn.style.display = "none";
  }

  if (activeSession && activeSession.is_active) {
    renderActive(activeSession);
  } else {
    renderInactive();
  }
}

// Save email
saveEmailBtn.addEventListener("click", async () => {
  const email = emailInput.value.trim();
  if (!email || !email.includes("@")) return;
  await chrome.storage.local.set({ userEmail: email });
  chrome.runtime.sendMessage({ type: "FORCE_CHECK" });
  render();
});

// Allow Enter key in email field
emailInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveEmailBtn.click();
});

// Force check button
checkBtn.addEventListener("click", () => {
  checkBtn.textContent = "Checking…";
  checkBtn.disabled = true;
  chrome.runtime.sendMessage({ type: "FORCE_CHECK" }, () => {
    setTimeout(() => {
      render();
      checkBtn.textContent = "Force Check Now";
      checkBtn.disabled = false;
    }, 2_000);
  });
});

render();
