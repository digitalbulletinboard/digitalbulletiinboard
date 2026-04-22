import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ref, push, onValue, remove, update, get, set }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const postsRef = ref(db, "posts");
let editingId   = null;
let allPosts    = [];
let currentFilter = 'all';

// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  const snap = await get(ref(db, "users/" + user.uid));
  if (!snap.exists() || snap.val().status !== "approved") {
    await signOut(auth); window.location.href = "login.html"; return;
  }
  document.getElementById("user-label").textContent = user.email;
  loadNotifications();
});

// ─── LOGOUT ───────────────────────────────────────────────────────────────────
window.logoutUser = async function() {
  await signOut(auth);
  window.location.href = "login.html";
};

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
function loadNotifications() {
  const notifRef = ref(db, "notifications");
  onValue(notifRef, (snapshot) => {
    const list  = document.getElementById("notif-list");
    const badge = document.getElementById("badge");
    list.innerHTML = "";
    let count = 0;
    if (!snapshot.exists()) {
      list.innerHTML = '<p class="empty-state">No pending requests</p>';
      badge.style.display = "none"; return;
    }
    snapshot.forEach(child => {
      const n   = child.val();
      const uid = child.key;
      if (n.status !== "unread" && n.notifStatus !== "unread") return;
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
        </div>`;
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

window.approveUser = async function(uid) {
  await update(ref(db, "users/" + uid), { status: "approved" });
  await update(ref(db, "notifications/" + uid), { status: "read", notifStatus: "read" });
};

window.rejectUser = async function(uid) {
  await update(ref(db, "users/" + uid), { status: "rejected" });
  await update(ref(db, "notifications/" + uid), { status: "read", notifStatus: "read" });
};

window.toggleNotifications = function() {
  document.getElementById("notif-panel").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("open");
};

// ─── TYPE CHANGE ─────────────────────────────────────────────────────────────
window.onTypeChange = function() {
  const type = getType();
  document.getElementById("content-group").style.display  = type === "text"  ? "block" : "none";
  document.getElementById("media-group").style.display    = type !== "text"  ? "block" : "none";
  document.getElementById("bgcolor-group").style.display  = type === "text"  ? "block" : "none";
  if (type === "image") document.getElementById("media-label").textContent = "Image URL";
  if (type === "video") document.getElementById("media-label").textContent = "Video URL";
};

function getType() {
  return document.querySelector('input[name="type"]:checked').value;
}

const CLOUDINARY_CLOUD_NAME    = "dmzmkkhao";    // from your Dashboard
const CLOUDINARY_UPLOAD_PRESET = "lckingcg"; // the preset you just created

}

// ─── SAVE / UPDATE POST ───────────────────────────────────────────────────────
window.savePost = function() {
  const title    = document.getElementById("title").value.trim();
  const content  = document.getElementById("content").value.trim();
  const type     = getType();
  const mediaUrl = document.getElementById("mediaUrl").value.trim();
  const duration = parseInt(document.getElementById("duration").value) || 7000;
  const category = document.getElementById("category").value.trim() || "General";
  const bgtheme  = document.getElementById("bgtheme").value;
  const fullscreen = document.getElementById("fullscreen").checked;

  if (!title) { alert("Please enter a title."); return; }

  const postData = { title, content, type, mediaUrl, duration, category, bgtheme, fullscreen, updatedAt: Date.now() };

  if (editingId) {
    update(ref(db, "posts/" + editingId), postData);
    editingId = null;
    document.getElementById("form-mode-label").textContent = "✨ New Slide";
    document.getElementById("save-btn-text").textContent   = "Save Slide";
  } else {
    postData.createdAt = Date.now();
    push(postsRef, postData);
  }
  clearForm();
};

// ─── FILTER ──────────────────────────────────────────────────────────────────
window.filterSlides = function(type, btn) {
  currentFilter = type;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderPosts(allPosts);
};

// ─── LOAD POSTS ───────────────────────────────────────────────────────────────
onValue(postsRef, (snapshot) => {
  allPosts = [];
  snapshot.forEach(child => {
    allPosts.push({ key: child.key, ...child.val() });
  });
  document.getElementById("post-count").textContent = allPosts.length;
  renderPosts(allPosts);
});

function renderPosts(posts) {
  const container = document.getElementById("posts");
  const filtered  = currentFilter === 'all' ? posts : posts.filter(p => p.type === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-slides">
        <div class="empty-icon">📭</div>
        <p>${posts.length === 0 ? 'No slides yet. Create your first one!' : 'No slides match this filter.'}</p>
      </div>`;
    return;
  }

  container.innerHTML = "";
  filtered.forEach(data => {
    const card = document.createElement("div");
    card.className = "post-card";

    const typeIcon = data.type === 'video' ? '🎥' : data.type === 'image' ? '🖼️' : '📝';
    const thumb = (data.type === 'image' && data.mediaUrl)
      ? `<img src="${data.mediaUrl}" class="post-thumb" alt="" onerror="this.style.display='none'">`
      : '';

    card.innerHTML = `
      ${thumb}
      <div class="post-info">
        <span class="post-type-badge ${data.type}">${typeIcon} ${data.type.charAt(0).toUpperCase()+data.type.slice(1)}</span>
        <div class="post-title">${data.title}</div>
        <div class="post-meta">${data.category} · ${data.duration || 7000}ms</div>
      </div>
      <div class="post-card-actions">
        <button class="btn-edit"   onclick='editPost(${JSON.stringify(data.key)}, ${JSON.stringify(data)})'>Edit</button>
        <button class="btn-delete" onclick="deletePost('${data.key}')">Delete</button>
      </div>`;
    container.appendChild(card);
  });
}

// ─── EDIT ─────────────────────────────────────────────────────────────────────
window.editPost = function(id, data) {
  editingId = id;
  document.querySelector(`input[name="type"][value="${data.type||'text'}"]`).checked = true;
  onTypeChange();
  document.getElementById("title").value    = data.title    || "";
  document.getElementById("content").value  = data.content  || "";
  document.getElementById("mediaUrl").value = data.mediaUrl || "";
  document.getElementById("duration").value = data.duration || "";
  document.getElementById("category").value = data.category || "";
  document.getElementById("bgtheme").value  = data.bgtheme  || "blue";
  document.getElementById("fullscreen").checked = data.fullscreen || false;
  document.getElementById("form-mode-label").textContent = "✏️ Editing Slide";
  document.getElementById("save-btn-text").textContent   = "Update Slide";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
window.deletePost = function(id) {
  if (confirm("Delete this slide?")) remove(ref(db, "posts/" + id));
};

// ─── CLEAR ────────────────────────────────────────────────────────────────────
window.clearForm = function() {
  document.getElementById("title").value    = "";
  document.getElementById("content").value  = "";
  document.getElementById("mediaUrl").value = "";
  document.getElementById("duration").value = "";
  document.getElementById("category").value = "";
  document.getElementById("bgtheme").value  = "blue";
  document.getElementById("fullscreen").checked = false;
  document.querySelector('input[name="type"][value="text"]').checked = true;
  onTypeChange();
  editingId = null;
  document.getElementById("form-mode-label").textContent = "✨ New Slide";
  document.getElementById("save-btn-text").textContent   = "Save Slide";
};
