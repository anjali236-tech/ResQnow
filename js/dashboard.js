/* dashboard.js — unified Firestore + Realtime Alerts
   - Works with your HTML structure:
     .cases-container  -> Firestore cases (All/Pending/Solved)
     #deviceAlertsSection -> realtime device alerts
   - Listens on Realtime DB path: /alerts
   - Supports alert.type or alert.alertType
*/

let allCases = [];
let currentUser = null;

// Realtime DB root (requires firebase-config to have been initialized)
let realtimeDB = null;
try {
  realtimeDB = firebase.database();
} catch (e) {
  console.warn("firebase.database() not available. Did you include firebase-database-compat and set databaseURL in firebase-config.js?");
}

let deviceAlerts = [];

/* ---------------------- BOOT ---------------------- */
document.addEventListener("DOMContentLoaded", function () {
  checkAuth();
  initializeDashboard();
});

/* ---------------------- AUTH ---------------------- */
function checkAuth() {
  const isLoggedIn = localStorage.getItem("isLoggedIn");
  const userData = localStorage.getItem("policeUser");

  if (!isLoggedIn || !userData) {
    // not logged in -> redirect to login
    window.location.href = "login.html";
    return;
  }

  currentUser = JSON.parse(userData);

  const userInfoEl = document.getElementById("userInfo");
  if (userInfoEl) {
    userInfoEl.innerHTML = `
      <strong>${currentUser.station}</strong>
      <span>Head ACP: ${currentUser.headACP}</span>
    `;
  }
}

/* ---------------------- INITIALIZE ---------------------- */
function initializeDashboard() {
  const refreshBtn = document.getElementById("refreshBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (refreshBtn) refreshBtn.addEventListener("click", () => { loadEmergencies(); loadDeviceAlerts(); });
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  // Attach tab click handlers (keeps your existing switchTab function compatible)
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", function () {
      switchTab(this.dataset.tab);
    });
  });

  const closeModalBtn = document.querySelector(".close-modal");
  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);

  const modal = document.getElementById("caseModal");
  if (modal) modal.addEventListener("click", function (e) {
    if (e.target === this) closeModal();
  });

  // Firestore cases
  loadEmergencies();
  setupRealTimeListener();

  // Realtime device alerts (only if firebase.database exists)
  if (realtimeDB) {
    setupDeviceAlertsListener();
  } else {
    console.warn("Realtime DB not initialized — device alerts will not be available until firebase-config includes databaseURL and firebase-database-compat.js is loaded.");
  }
}

/* ---------------------- FIRESTORE: Emergencies ---------------------- */
function loadEmergencies() {
  showLoading(true);

  db.collection("emergencies")
    .orderBy("timestamp", "desc")
    .get()
    .then((snapshot) => {
      allCases = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      updateDashboard();
      showLoading(false);
    })
    .catch((error) => {
      console.error("Error loading emergencies:", error);
      showError("Failed to load emergency cases");
      showLoading(false);
    });
}

function setupRealTimeListener() {
  db.collection("emergencies")
    .orderBy("timestamp", "desc")
    .onSnapshot(
      (snapshot) => {
        allCases = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        updateDashboard();
      },
      (error) => {
        console.error("Firestore real-time listener error:", error);
      }
    );
}

/* ---------------------- DASHBOARD UPDATE ---------------------- */
function updateDashboard() {
  updateStats();
  updateTabCounts();
  // If device alerts tab is active, show device alerts; otherwise display cases
  const activeTab = document.querySelector(".tab-button.active")?.dataset.tab || "all";
  if (activeTab === "deviceAlerts") {
    displayDeviceAlerts();
  } else {
    displayCases(activeTab);
  }
}

function updateStats() {
  const total = allCases.length + deviceAlerts.length; // combined view
  const pending = allCases.filter((c) => c.status !== "resolved").length + deviceAlerts.length;
  const solved = allCases.filter((c) => c.status === "resolved").length;

  const totalEl = document.getElementById("totalCases");
  const pendingEl = document.getElementById("pendingCases");
  const solvedEl = document.getElementById("solvedCases");

  if (totalEl) totalEl.textContent = total;
  if (pendingEl) pendingEl.textContent = pending;
  if (solvedEl) solvedEl.textContent = solved;
}

function updateTabCounts() {
  const allCount = allCases.length;
  const pendingCount = allCases.filter((caseItem) => caseItem.status !== "resolved").length;
  const solvedCount = allCases.filter((caseItem) => caseItem.status === "resolved").length;

  const allCountEl = document.getElementById("allCount");
  const pendingCountEl = document.getElementById("pendingCount");
  const solvedCountEl = document.getElementById("solvedCount");
  const deviceCountEl = document.getElementById("deviceAlertsCount");

  if (allCountEl) allCountEl.textContent = allCount;
  if (pendingCountEl) pendingCountEl.textContent = pendingCount;
  if (solvedCountEl) solvedCountEl.textContent = solvedCount;
  if (deviceCountEl) deviceCountEl.textContent = deviceAlerts.length;
}

/* ---------------------- TAB SWITCHING (compatible with your HTML) ---------------------- */
function switchTab(tabName) {
  const btns = document.querySelectorAll(".tab-button");
  btns.forEach((b) => b.classList.remove("active"));
  const selBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (selBtn) selBtn.classList.add("active");

  // Your main cases container (the one from HTML)
  const mainCases = document.querySelector(".cases-container");
  const deviceSection = document.getElementById("deviceAlertsSection");

  // Hide both
  if (mainCases) mainCases.style.display = "none";
  if (deviceSection) deviceSection.style.display = "none";

  // Show requested
  if (tabName === "deviceAlerts") {
    if (deviceSection) deviceSection.style.display = "block";
    // request fresh data (listener already running but this ensures UI updates)
    displayDeviceAlerts();
    // if realtime isn't initialized, warn
    if (!realtimeDB) console.warn("Realtime DB not available. Check firebase-config.js for databaseURL and include firebase-database-compat.js.");
  } else {
    if (mainCases) mainCases.style.display = "block";
    displayCases(tabName);
  }
}

/* ---------------------- FIRESTORE CASE DISPLAY ---------------------- */
function displayCases(tabName) {
  let filteredCases = [];
  switch (tabName) {
    case "all":
      filteredCases = allCases;
      if (document.getElementById("noCasesText")) document.getElementById("noCasesText").textContent = "No emergency requests received yet";
      break;

    case "pending":
      filteredCases = allCases.filter((c) => c.status !== "resolved");
      if (document.getElementById("noCasesText")) document.getElementById("noCasesText").textContent = "No pending cases";
      break;

    case "solved":
      filteredCases = [
        ...allCases.filter((c) => c.status === "resolved"),
        ...deviceAlerts.filter((a) => a.status === "resolved")
      ];
      if (document.getElementById("noCasesText")) document.getElementById("noCasesText").textContent = "No solved cases";
      break;

    default:
      filteredCases = allCases;
  }

  const casesList = document.getElementById("casesList");
  const noCasesMessage = document.getElementById("noCasesMessage");

  if (!casesList) {
    console.error("Element #casesList not found in HTML.");
    return;
  }

  if (filteredCases.length === 0) {
    casesList.innerHTML = "";
    if (noCasesMessage) noCasesMessage.style.display = "block";
    return;
  }

  if (noCasesMessage) noCasesMessage.style.display = "none";

  casesList.innerHTML = filteredCases.map((caseItem) => `
    <div class="case-card" data-case-id="${caseItem.id}">
      <div class="case-header">
        <div class="case-status ${caseItem.status === "resolved" ? "solved" : "pending"}">
          ${caseItem.status === "resolved" ? "✅" : "🚨"}
        </div>
        <div class="case-title">
          <h3>${caseItem.userName || "Belapur"}</h3>
          <p>${caseItem.userPhone || "Device Alert"}</p>
        </div>
        <div class="case-time">${formatTimestampForFirestore(caseItem.timestamp)}</div>
      </div>

      <div class="case-body">
        <p>📍 ${caseItem.formattedAddress || caseItem.userAddress || "Belapur Highway"}</p>
        ${
          caseItem.status === "resolved"
            ? `<p class="resolved-info">✅ Resolved by ${caseItem.resolvedBy || "Police"}</p>`
            : '<p class="pending-info">⏳ Requires attention</p>'
        }
      </div>

      <div class="case-actions">
        <button class="view-btn"
          style="background:#007bff; color:#fff; border:none; padding:10px 16px; border-radius:6px; font-weight:600; cursor:pointer;"
          data-id="${caseItem.id}"
          data-source="app">
          View Details
        </button>
        ${
          caseItem.status !== "resolved"
            ? `<button class="btn-resolve"
                style="background:#28a745; color:#fff; border:none; padding:10px 16px; border-radius:7px; font-weight:600; cursor:pointer;width:120px"
                onclick="resolveCase('${caseItem.id}')">Mark Handled</button>`
            : ''
        }
      </div>
    </div>
  `).join("");
}


/* ---------------------- REALTIME DEVICE ALERTS ---------------------- */
function setupDeviceAlertsListener() {
  if (!realtimeDB) return;

  const alertsRef = realtimeDB.ref("alerts");

  alertsRef.on("value", (snapshot) => {
    deviceAlerts = [];
    if (snapshot.exists()) {
      snapshot.forEach((child) => {
        // child.val() is the alert object
        deviceAlerts.push({ id: child.key, ...child.val() });
      });
    }

    // UI updates
    displayDeviceAlerts();
    updateTabCounts();
  }, (err) => {
    console.error("Realtime DB listener error:", err);
  });
}

function loadDeviceAlerts() {
  // For compatibility: just call displayDeviceAlerts() because listener already updates deviceAlerts.
  if (!realtimeDB) {
    console.warn("Realtime DB not available. Can't load device alerts.");
    return;
  }
  displayDeviceAlerts();
}

function displayDeviceAlerts() {
  const list = document.getElementById("deviceAlertsList");
  const noData = document.getElementById("noDeviceAlerts");
  const loading = document.getElementById("deviceAlertsLoading");
  const countSpan = document.getElementById("deviceAlertsCount");

  if (!list) {
    console.error("Element #deviceAlertsList not found.");
    return;
  }

  if (loading) loading.style.display = "none";

  if (!deviceAlerts || deviceAlerts.length === 0) {
    if (noData) noData.style.display = "block";
    list.innerHTML = "";
    if (countSpan) countSpan.textContent = 0;
    return;
  }

  if (noData) noData.style.display = "none";
  if (countSpan) countSpan.textContent = deviceAlerts.length;

  // Build HTML cards
  list.innerHTML = deviceAlerts
  .filter(alert => alert.status !== "resolved")
  .map((alert) => {

    // Use either alert.type or legacy alert.alertType
    const alertType = alert.type || alert.alertType || "Emergency";
    const timestampText = formatDeviceTimestamp(alert.timestamp);




    // Location fallback: allow combined lat/lng or address string
    const locationText = alert.location ?
      alert.location :
      ((alert.latitude || alert.longitude) ? `${alert.latitude || "0"}, ${alert.longitude || "0"}` : "Unknown");

    const deviceId = alert.deviceId || alert.device || "Unknown Device";
    const message = alert.message || "No message provided";
    const status = alert.status || "pending";

    return `
      <div class="case-card" data-alert-id="${alert.id}">
        <div class="case-header">
          <div class="case-status device-alert">📡</div>
          <div class="case-title">
            <h3>${deviceId}</h3>
            <p>${message}</p>
          </div>
          <div class="case-time">${timestampText}</div>
        </div>
        <div class="case-body">
          <p><strong>Type:</strong> ${alertType}</p>
          <p><strong>Status:</strong> ${status}</p>
          <p><strong>Location:</strong> ${locationText}</p>
        </div>
        <div class="case-actions">
  <button class="btn-view"
          style="background:#007bff; color:#fff; border:none; padding:10px 16px; border-radius:6px; font-weight:600; cursor:pointer; width:120px;"
          onclick="viewDeviceAlertDetails('${alert.id}')">View Details</button>
  
  <button class="btn-resolve"
          style="background:#28a745; color:#fff; border:none; padding:10px 16px; border-radius:6px; font-weight:600; cursor:pointer; width:120px;"
          onclick="resolveDeviceAlert('${alert.id}')">Mark Handled</button>
</div>

      </div>
    `;
  }).join("");
}

/* ---------------------- Device Alert actions ---------------------- */
function viewDeviceAlertDetails(alertId) {
  const alert = deviceAlerts.find((a) => a.id === alertId);
  if (!alert) return;

  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = `
    <div class="case-details">
      <div class="detail-section">
        <h3>IoT Device Alert Details</h3>
        <div class="detail-grid">
          <div class="detail-item"><label>Alert ID:</label><span>${alert.id}</span></div>
          <div class="detail-item"><label>Device:</label><span>${alert.deviceId || alert.device || "Unknown"}</span></div>
          <div class="detail-item"><label>Time:</label><span>${formatDeviceTimestamp(alert.timestamp)}</span>


        </div>
      </div>
      <div class="detail-section">
        <h3>Message</h3>
        <p>${alert.message || "No message provided"}</p>
      </div>
      <div class="detail-section">
        <h3>Raw Data</h3>
        <pre>${JSON.stringify(alert, null, 2)}</pre>
      </div>
      <div class="detail-section">
        <button class="btn-resolve" onclick="resolveDeviceAlert('${alert.id}')">✅ MARK AS HANDLED</button>
      </div>
    </div>
  `;
  document.getElementById("caseModal").style.display = "block";
}

function resolveDeviceAlert(alertId) {
  if (!confirm("Mark this device alert as handled?")) return;
  if (!realtimeDB) {
    alert("Realtime DB not configured.");
    return;
  }

  const selectedAlert = deviceAlerts.find(a => a.id === alertId);
  if (!selectedAlert) {
    alert("Alert not found");
    return;
  }

  // ✅ 1. Update status in Realtime DB
  realtimeDB.ref(`alerts/${alertId}`).update({
    status: "resolved",
    resolvedAt: Date.now(),
    resolvedBy: currentUser?.headACP || "Police"
  })
  .then(() => {
    // ✅ 2. Save to Firestore Solved Collection
    return db.collection("solved_device_alerts").doc(alertId).set({
      ...selectedAlert,
      status: "resolved",
      resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
      resolvedBy: currentUser?.headACP || "Police"
    });
  })
  .then(() => {
    alert("✅ Device alert marked as handled!");
    closeModal();
  })
  .catch((err) => {
    console.error("Resolve error:", err);
    alert("Failed to resolve alert: " + err.message);
  });
}


/* ---------------------- HELPERS & EXISTING ACTIONS ---------------------- */

function viewCaseDetails(caseId) {
  const caseItem = allCases.find((c) => c.id === caseId);
  if (!caseItem) return;

  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = `
    <div class="case-details">
      <div class="detail-section">
        <h3>User Information</h3>
        <div class="detail-grid">
          <div class="detail-item"><label>Name:</label><span>${caseItem.userName || "Unknown"}</span></div>
          <div class="detail-item"><label>Phone:</label><span>${caseItem.userPhone || "Unknown"}</span></div>
          <div class="detail-item"><label>Age:</label><span>${caseItem.userAge || "Unknown"}</span></div>
          <div class="detail-item"><label>Email:</label><span>${caseItem.userEmail || "Unknown"}</span></div>
        </div>
      </div>
      <div class="detail-section">
        <h3>Location</h3>
        <div class="detail-grid">
          <div class="detail-item full-width"><label>Address:</label><span>${caseItem.formattedAddress || caseItem.userAddress || "Unknown"}</span></div>
        </div>
      </div>
      <div class="detail-section">
        ${caseItem.status !== "resolved" ? `<button class="btn-resolve" onclick="resolveCase('${caseItem.id}')">✅ APPROVE & SEND HELP</button>` : `<p>Resolved by ${caseItem.resolvedBy || "Police"}</p>`}
      </div>
    </div>
  `;
  document.getElementById("caseModal").style.display = "block";
}

function resolveCase(caseId) {
  if (!confirm("Are you sure you want to mark this case as resolved?")) return;
  const userData = JSON.parse(localStorage.getItem("policeUser") || "{}");

  db.collection("emergencies").doc(caseId).update({
    status: "resolved",
    resolvedBy: userData.headACP || "Police",
    resolvedStation: userData.station || "Unknown",
    resolvedAt: firebase.firestore.FieldValue.serverTimestamp(),
    resolutionMessage: "Help is on the way! Police team dispatched to your location."
  })
  .then(() => {
    return db.collection("notifications").add({
      userId: allCases.find((c) => c.id === caseId)?.userId || null,
      emergencyId: caseId,
      title: "Emergency Update",
      message: "Help is on the way! Police team dispatched to your location.",
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      type: "status_update",
      read: false
    });
  })
  .then(() => {
    alert("Case resolved successfully!");
    closeModal();
  })
  .catch((error) => {
    console.error("Error resolving case:", error);
    alert("Error resolving case: " + error.message);
  });
}

function openGoogleMaps(lat, lng) {
  window.open(`https://maps.google.com/?q=${lat},${lng}`, "_blank");
}
function callNumber(phoneNumber) { window.open(`tel:${phoneNumber}`); }
function closeModal() { const m=document.getElementById("caseModal"); if(m) m.style.display = "none"; }
function logout() {
  if (confirm("Are you sure you want to logout?")) {
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("policeUser");
    window.location.href = "login.html";
  }
}
function showLoading(show) { const el = document.getElementById("loadingMessage"); if (el) el.style.display = show ? "block" : "none"; }
function showError(message) { alert("Error: " + message); }

/* ---------------------- TIMESTAMP FORMATTING HELPERS ---------------------- */
function formatDeviceTimestamp(ts) {
  if (!ts) return "Unknown time";

  const num = (typeof ts === "string") ? parseInt(ts) : ts;
  if (!isNaN(num) && num > 0) {
    if (num < 1e12) return new Date(num * 1000).toLocaleString();
    return new Date(num).toLocaleString();
  }

  const parsed = new Date(ts);
  if (!isNaN(parsed.getTime())) return parsed.toLocaleString();

  return String(ts);
}



function formatTimestampForFirestore(timestamp) {
  if (!timestamp) return "Unknown time";

  let dateObj;

  // If Firestore timestamp object
  if (typeof timestamp === "object" && timestamp.toDate) {
    dateObj = timestamp.toDate();
  } 
  // If timestamp is in seconds (10-digit number)
  else if (!isNaN(timestamp)) {
    const num = Number(timestamp);
    if (num < 1e12) {
      // treat as seconds
      dateObj = new Date(num * 1000);
    } else {
      // treat as milliseconds
      dateObj = new Date(num);
    }
  } else {
    // fallback: try Date parse
    dateObj = new Date(timestamp);
  }

  if (isNaN(dateObj.getTime())) return "Unknown time";

  return dateObj.toLocaleString();
}

function openSolvedDeviceAlert(alert) {
  const modal = document.getElementById("caseModal");
  const modalBody = document.getElementById("modalBody");

  modalBody.innerHTML = `
    <p><strong>Device ID:</strong> ${alert.deviceId}</p>
    <p><strong>Type:</strong> ${alert.type}</p>
    <p><strong>Message:</strong> ${alert.message}</p>
    <p><strong>Status:</strong> ${alert.status}</p>
    <p><strong>Time:</strong> ${alert.timestamp}</p>
    <p><strong>Location:</strong> ${alert.location}</p>
  `;

  modal.style.display = "block";
}

function openCaseModal(id, source) {
  let caseData;

  // ✅ If it's from Firestore (App alert)
  if (source === "app") {
    caseData = allCases.find((c) => c.id === id);
  } 
  // ✅ If it's from Realtime DB device alert
  else if (source === "device") {
    caseData = deviceAlerts.find((a) => a.id === id);
  }

  if (!caseData) {
    console.error("Case not found:", id);
    return;
  }

  // ✅ Fill modal just like alert section
  const modalBody = document.getElementById("modalBody");
  modalBody.innerHTML = `
    <div class="case-details">
      <h3>${caseData.userName || caseData.deviceId || "Unknown"}</h3>
      <p><strong>Phone:</strong> ${caseData.userPhone || "N/A"}</p>
      <p><strong>Address:</strong> ${caseData.formattedAddress || caseData.location || "N/A"}</p>
      <p><strong>Status:</strong> ${caseData.status}</p>
      <p><strong>Time:</strong> ${formatTimestampForFirestore(caseData.timestamp)}</p>
    </div>
  `;

  document.getElementById("caseModal").style.display = "block";
}

// ... all functions above

// ✅ View Details Button Listener (Works for ALL tabs)
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("view-btn")) {
    const id = e.target.getAttribute("data-id");
    const source = e.target.getAttribute("data-source");
    openCaseModal(id, source);
  }
});
