const firebaseConfig = {
  apiKey: "AIzaSyCKyw5p3j0ag96X6Erob3vmzYcRtU22Clw",
  authDomain: "resqnow-60fa7.firebaseapp.com",
  projectId: "resqnow-60fa7",
  storageBucket: "resqnow-60fa7.firebasestorage.app",
  messagingSenderId: "214172078112",
  appId: "1:214172078112:web:171a69465afe4be7396c45",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services
const db = firebase.firestore();
const auth = firebase.auth();
