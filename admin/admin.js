import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  ref, push, onValue, remove, update, get
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const postsRef = ref(db, "posts");
let editingId = null;

// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  // Verify they are approved in DB
  const snap = await get(ref(db, "users/" + user.uid));
  if (!snap.exists() || snap.val().status !== "approved") {
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  document.getElementById("user-label").textContent = user.email;
  loadNotifications();
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
window.logoutUser = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

// ─── NOTIFICATIONS (access requests) ─────────────────────────────────────────
function loadNotifications() {
  const notifRef = ref(db, "notifications");
  onValue(notifRef, (snapshot) => {
    const list = document.getElementById("notif-list");
    const badge = document.getElementById("badge");
    list.innerHTML = "";
    let count = 0;

    if (!snapshot.exists()) {
      list.innerHTML = '<p class="empty-state">No pending requests</p>';
      badge.style.display = "none";
      return;
    }

    snapshot.forEach(child => {
      const n = child.val();
      const uid = child.key;
      if (n.status !== "unread") return;
      count++;

      const card = document.createElement("div");
      card.className = "notif-card";
      card.innerHTML = `
        <div class="notif-name">👤 ${n.name}</div>
        <div class="notif-email">${n.email}</div>
        <div class="notif-reason">"${n.reason}"</div>
        <div class="notif-actions">
          <button class="btn-approve" onclick="approveUser('${uid}')">✅ Approve</button>
          <button class="btn-reject"  onclick="rejectUser('${uid}')">❌ Reject</button>
        </div>
      `;
      list.appendChild(card);
    });

    if (count === 0) {
      list.innerHTML = '<p class="empty-state">No pending requests</p>';
      badge.style.display = "none";
    } else {
      badge.textContent = count;
      badge.style.display = "flex";
    }
  });
}

window.approveUser = async function (uid) {
  await update(ref(db, "users/" + uid), { status: "approved" });
  await update(ref(db, "notifications/" + uid), { status: "read" });
};

window.rejectUser = async function (uid) {
  await update(ref(db, "users/" + uid), { status: "rejected" });
  await update(ref(db, "notifications/" + uid), { status: "read" });
};

window.toggleNotifications = function () {
  document.getElementById("notif-panel").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("open");
};

// ─── VIDEO URL TOGGLE ─────────────────────────────────────────────────────────
window.toggleVideoUrl = function () {
  const type = document.getElementById("type").value;
  document.getElementById("video-url-group").style.display = type === "video" ? "block" : "none";
};

// ─── SAVE / UPDATE POST ───────────────────────────────────────────────────────
window.addPost = function () {
  const title     = document.getElementById("title").value.trim();
  const content   = document.getElementById("content").value.trim();
  const type      = document.getElementById("type").value;
  const url       = document.getElementById("videoUrl").value.trim();
  const duration  = document.getElementById("duration").value || 5000;
  const category  = document.getElementById("category").value.trim();
  const fullscreen = document.getElementById("fullscreen").checked;

  if (!title) return;

  const postData = { title, content, type, url, duration: Number(duration), category, fullscreen };

  if (editingId) {
    update(ref(db, "posts/" + editingId), postData);
    editingId = null;
    document.getElementById("form-mode-label").textContent = "New Post";
    document.getElementById("save-btn-text").textContent = "Save Post";
  } else {
    push(postsRef, postData);
  }
  clearForm();
};

// ─── DISPLAY POSTS ────────────────────────────────────────────────────────────
onValue(postsRef, (snapshot) => {
  const container = document.getElementById("posts");
  container.innerHTML = "";
  let count = 0;

  snapshot.forEach(child => {
    const data = child.val();
    const key  = child.key;
    count++;

    const card = document.createElement("div");
    card.className = "post-card";
    card.innerHTML = `
      <div class="post-info">
        <span class="post-type-badge ${data.type}">${data.type === "video" ? "🎥 Video" : "📝 Text"}</span>
        <div class="post-title">${data.title}</div>
        <div class="post-meta">${data.category || "Uncategorized"} · ${data.duration || 5000}ms</div>
      </div>
      <div class="post-card-actions">
        <button class="btn-edit" onclick="editPost('${key}', ${JSON.stringify(data).replace(/'/g, "&#39;")})">Edit</button>
        <button class="btn-delete" onclick="deletePost('${key}')">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });

  document.getElementById("post-count").textContent = count;
});

// ─── EDIT ─────────────────────────────────────────────────────────────────────
window.editPost = function (id, data) {
  editingId = id;
  document.getElementById("title").value     = data.title || "";
  document.getElementById("content").value   = data.content || "";
  document.getElementById("type").value      = data.type || "text";
  document.getElementById("videoUrl").value  = data.url || "";
  document.getElementById("duration").value  = data.duration || "";
  document.getElementById("category").value  = data.category || "";
  document.getElementById("fullscreen").checked = data.fullscreen || false;
  document.getElementById("video-url-group").style.display = data.type === "video" ? "block" : "none";
  document.getElementById("form-mode-label").textContent = "Editing Post";
  document.getElementById("save-btn-text").textContent = "Update Post";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
window.deletePost = function (id) {
  if (confirm("Delete this post?")) remove(ref(db, "posts/" + id));
};

// ─── CLEAR ────────────────────────────────────────────────────────────────────
window.clearForm = function () {
  ["title","content","videoUrl","duration","category"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("fullscreen").checked = false;
  document.getElementById("video-url-group").style.display = "none";
  editingId = null;
  document.getElementById("form-mode-label").textContent = "New Post";
  document.getElementById("save-btn-text").textContent = "Save Post";
};