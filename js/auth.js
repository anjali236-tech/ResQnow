// Police station credentials (in real app, this would be in a secure database)
const policeStations = {
  "Central Police Station": {
    pincode: "110001",
    password: "central123",
    headACP: "Rajesh Kumar",
  },
  "North Police Station": {
    pincode: "110054",
    password: "north123",
    headACP: "Anita Sharma",
  },
  "South Police Station": {
    pincode: "110049",
    password: "south123",
    headACP: "Vikram Singh",
  },
  "East Police Station": {
    pincode: "110091",
    password: "east123",
    headACP: "Priya Patel",
  },
  "West Police Station": {
    pincode: "110063",
    password: "west123",
    headACP: "Alok Verma",
  },
  "North Police Station": {
    pincode: "1234",
    password: "1234",
    headACP: "ABCD",
  },
};

document.getElementById("loginForm").addEventListener("submit", function (e) {
  e.preventDefault();
  login();
});

function login() {
  const station = document.getElementById("station").value;
  const pincode = document.getElementById("pincode").value;
  const password = document.getElementById("password").value;
  const headACP = document.getElementById("headACP").value;
  const district = document.getElementById("district").value;
  const state = document.getElementById("state").value;
  const badgeNumber = document.getElementById("badgeNumber").value;

  const loginBtn = document.getElementById("loginBtn");
  const errorDiv = document.getElementById("errorMessage");

  // Reset states
  loginBtn.disabled = true;
  loginBtn.innerHTML = "<span>Authenticating...</span>";
  errorDiv.style.display = "none";

  // Validate credentials
  const stationData = policeStations[station];
  if (
    !stationData ||
    stationData.pincode !== pincode ||
    stationData.password !== password ||
    stationData.headACP !== headACP
  ) {
    showError("Invalid credentials. Please check your details.");
    resetLoginButton();
    return;
  }

  // Simulate authentication (in real app, this would be proper Firebase Auth)
  setTimeout(() => {
    // Store user data in localStorage
    const userData = {
      station: station,
      pincode: pincode,
      headACP: headACP,
      district: district,
      state: state,
      badgeNumber: badgeNumber,
      loginTime: new Date().toISOString(),
    };

    localStorage.setItem("policeUser", JSON.stringify(userData));
    localStorage.setItem("isLoggedIn", "true");

    // Redirect to dashboard
    window.location.href = "dashboard.html";
  }, 1500);
}

function showError(message) {
  const errorDiv = document.getElementById("errorMessage");
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
}

function resetLoginButton() {
  const loginBtn = document.getElementById("loginBtn");
  loginBtn.disabled = false;
  loginBtn.innerHTML =
    '<span>ACCESS DASHBOARD</span><span class="btn-arrow">→</span>';
}

// Auto-fill other fields when station is selected
document.getElementById("station").addEventListener("change", function () {
  const station = this.value;
  const stationData = policeStations[station];

  if (stationData) {
    document.getElementById("pincode").value = stationData.pincode;
    document.getElementById("headACP").value = stationData.headACP;
  }
});
