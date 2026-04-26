// firebase.js — shared Firebase initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase }   from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";
import { getAuth }       from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBOm8OKOhHd_PCf8FeRkkscffne81MAaFc",
  authDomain:        "digitalbulletinboard-54f06.firebaseapp.com",
  databaseURL:       "https://digitalbulletinboard-54f06-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "digitalbulletinboard-54f06",
  storageBucket:     "digitalbulletinboard-54f06.firebasestorage.app",
  messagingSenderId: "987342604782",
  appId:             "1:987342604782:web:90f8a7e895e8f8a2b026ff"
};

const app = initializeApp(firebaseConfig);
export const db   = getDatabase(app);
export const auth = getAuth(app);
