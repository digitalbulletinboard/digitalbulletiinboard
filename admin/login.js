import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  ref, set, get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

window.showTab = function(tab) {
  document.getElementById("form-login").style.display    = tab === "login"    ? "block" : "none";
  document.getElementById("form-register").style.display = tab === "register" ? "block" : "none";
  document.getElementById("tab-login").classList.toggle("active",    tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
};

// ─── LOGIN ────────────────────────────────────────────────────────────────────
window.loginUser = async function () {
  const email    = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const msg      = document.getElementById("login-msg");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    // Check approval status in DB
    const snap = await get(ref(db, "users/" + uid));
    if (!snap.exists()) {
      msg.className = "msg error";
      msg.textContent = "User record not found. Contact the administrator.";
      await auth.signOut();
      return;
    }

    const userData = snap.val();

    if (userData.status === "pending") {
      msg.className = "msg pending";
      msg.textContent = "⏳ Your access request is awaiting admin approval.";
      await auth.signOut();
      return;
    }

    if (userData.status === "rejected") {
      msg.className = "msg error";
      msg.textContent = "❌ Your access request was rejected. Contact the administrator.";
      await auth.signOut();
      return;
    }

    if (userData.status === "approved") {
      // Redirect to admin panel
      window.location.href = "admin.html";
      return;
    }

  } catch (err) {
    msg.className = "msg error";
    msg.textContent = getAuthError(err.code);
  }
};

// ─── REGISTER (request access) ───────────────────────────────────────────────
window.registerUser = async function () {
  const name     = document.getElementById("reg-name").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const reason   = document.getElementById("reg-reason").value.trim();
  const msg      = document.getElementById("reg-msg");

  if (!name || !email || !password || !reason) {
    msg.className = "msg error";
    msg.textContent = "Please fill in all fields.";
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uid  = cred.user.uid;

    // Save user request to DB — status: pending
    await set(ref(db, "users/" + uid), {
      name,
      email,
      reason,
      status: "pending",
      requestedAt: Date.now()
    });

    // Notify super-admin via DB notification node
    await set(ref(db, "notifications/" + uid), {
      type: "access_request",
      name,
      email,
      reason,
      uid,
      status: "unread",
      createdAt: Date.now()
    });

    msg.className = "msg success";
    msg.textContent = "✅ Request submitted! An admin will review your access shortly.";

    // Sign them back out — they can't use the app until approved
    await auth.signOut();

  } catch (err) {
    msg.className = "msg error";
    msg.textContent = getAuthError(err.code);
  }
};

// ─── FRIENDLY ERROR MESSAGES ─────────────────────────────────────────────────
function getAuthError(code) {
  const map = {
    "auth/email-already-in-use":   "This email is already registered.",
    "auth/invalid-email":          "Please enter a valid email address.",
    "auth/weak-password":          "Password must be at least 6 characters.",
    "auth/user-not-found":         "No account found with this email.",
    "auth/wrong-password":         "Incorrect password. Please try again.",
    "auth/too-many-requests":      "Too many attempts. Please try again later.",
  };
  return map[code] || "Something went wrong. Please try again.";
}