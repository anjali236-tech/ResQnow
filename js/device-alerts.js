// -----------------------------
// REALTIME DATABASE - DEVICE ALERTS
// -----------------------------
const realtimeDB = firebase.database();
let deviceAlerts = [];

// Load alerts from Realtime DB
function loadDeviceAlerts() {
  const alertsRef = realtimeDB.ref("alerts");

  alertsRef.on("value", (snapshot) => {
    const deviceAlertsList = document.getElementById("deviceAlertsList");
    const loading = document.getElementById("deviceAlertsLoading");
    const noData = document.getElementById("noDeviceAlerts");
    const countSpan = document.getElementById("deviceAlertsCount");

    deviceAlertsList.innerHTML = "";
    loading.style.display = "none";
    deviceAlerts = []; // reset local list

    if (!snapshot.exists()) {
      noData.style.display = "block";
      countSpan.textContent = 0;
      return;
    }

    noData.style.display = "none";

    let count = 0;

    snapshot.forEach((alertSnap) => {
      const alert = alertSnap.val();
      alert.id = alertSnap.key; // save ID for later
      deviceAlerts.push(alert); // store locally
      count++;

      const card = document.createElement("div");
      card.className = "case-card";

      card.innerHTML = `
        <h3>🚨 Device Alert</h3>
        <p><strong>Device:</strong> ${alert.deviceId}</p>
        <p><strong>Type:</strong> ${alert.type || "Emergency"}</p>
        <p><strong>Message:</strong> ${alert.message || "Emergency Triggered"}</p>
        <p><strong>Status:</strong> ${alert.status}</p>
        <p><strong>Time:</strong> ${alert.timestamp}</p>
        <p><strong>Location:</strong> ${alert.location}</p>
        <button class="btn-primary view-details-btn" data-id="${alert.id}">
          👁 View Details
        </button>
      `;

      deviceAlertsList.appendChild(card);
    });

    countSpan.textContent = count;

    // Attach button click listeners
    attachDeviceAlertModalEvents();
  });
}

// ✅ Open Modal with SAME details
function attachDeviceAlertModalEvents() {
  const buttons = document.querySelectorAll(".view-details-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const alertId = btn.getAttribute("data-id");
      const alert = deviceAlerts.find((a) => a.id === alertId);

      openDeviceAlertModal(alert);
    });
  });
}

// ✅ Reuse dashboard modal
function openDeviceAlertModal(alert) {
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

// ✅ Close Modal (uses existing close button)
document.querySelector(".close-modal").addEventListener("click", () => {
  document.getElementById("caseModal").style.display = "none";
});

// Listen when tab is opened
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("deviceAlertsSection")) {
    loadDeviceAlerts();
  }
});
