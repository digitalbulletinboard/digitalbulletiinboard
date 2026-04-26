import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ref, push, onValue, remove, update, get }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── CLOUDINARY CONFIG ─────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME    = "YOUR_CLOUD_NAME";
const CLOUDINARY_UPLOAD_PRESET = "YOUR_UPLOAD_PRESET";

// ── STATE ─────────────────────────────────────────────────────────────────────
const postsRef       = ref(db, "posts");
let editingId        = null;
let allPosts         = [];          // always the full list from Firebase
let currentFilter    = "all";
let resolvedImageUrl = "";
let resolvedVideoUrl = "";
let postsUnsubscribe = null;        // so we only attach ONE onValue listener

// ── AUTH GUARD ────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }

  const snap = await get(ref(db, "users/" + user.uid));
  if (!snap.exists() || snap.val().status !== "approved") {
    await signOut(auth);
    window.location.href = "login.html";
    return;
  }

  document.getElementById("user-label").textContent = user.email;
  setupDropZones();
  loadNotifications();
  startListeningToPosts();   // ← attach Firebase listener ONLY after auth confirmed
});

// ── FIREBASE POSTS LISTENER ───────────────────────────────────────────────────
function startListeningToPosts() {
  if (postsUnsubscribe) return;   // already attached

  postsUnsubscribe = onValue(postsRef, (snapshot) => {
    allPosts = [];
    snapshot.forEach(child => {
      allPosts.push({ _key: child.key, ...child.val() });
    });
    document.getElementById("post-count").textContent = allPosts.length;
    renderPosts();
  });
}

// ── RENDER ADMIN SLIDES LIST ──────────────────────────────────────────────────
function renderPosts() {
  const container = document.getElementById("posts");
  const filtered  = currentFilter === "all"
    ? allPosts
    : allPosts.filter(p => p.type === currentFilter);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-slides">
        <div class="empty-icon">📭</div>
        <p>${allPosts.length === 0
          ? "No slides yet. Create your first one!"
          : "No slides match this filter."}</p>
      </div>`;
    return;
  }

  container.innerHTML = "";

  filtered.forEach(item => {
    const card     = document.createElement("div");
    card.className = "post-card";

    // Thumbnail
    let thumb = "";
    if (item.type === "image" && item.mediaUrl) {
      thumb = `<img src="${item.mediaUrl}" class="post-thumb" alt=""
                    onerror="this.style.display='none'">`;
    } else if (item.type === "video") {
      thumb = `<div class="post-thumb"
                    style="background:#000;display:flex;align-items:center;
                           justify-content:center;font-size:22px">🎥</div>`;
    }

    const typeIcon  = item.type === "video" ? "🎥" : item.type === "image" ? "🖼️" : "📝";
    const typeLabel = item.type.charAt(0).toUpperCase() + item.type.slice(1);

    card.innerHTML = `
      ${thumb}
      <div class="post-info">
        <span class="post-type-badge ${item.type}">${typeIcon} ${typeLabel}</span>
        <div class="post-title">${escHtml(item.title || "")}</div>
        <div class="post-meta">${escHtml(item.category || "")} · ${item.duration || 7000}ms${item.fullscreen ? " · Fullscreen" : ""}</div>
      </div>
      <div class="post-card-actions">
        <button class="btn-edit"   data-key="${escHtml(item._key)}">Edit</button>
        <button class="btn-delete" data-key="${escHtml(item._key)}">Delete</button>
      </div>`;

    // Attach events directly (no inline onclick JSON hacks)
    card.querySelector(".btn-edit").addEventListener("click",   () => editPost(item._key));
    card.querySelector(".btn-delete").addEventListener("click", () => deletePost(item._key));

    container.appendChild(card);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── FILTER ────────────────────────────────────────────────────────────────────
window.filterSlides = function (type, btn) {
  currentFilter = type;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderPosts();
};

// ── SAVE / UPDATE ─────────────────────────────────────────────────────────────
window.savePost = async function () {
  const type       = getType();
  const title      = document.getElementById("title").value.trim();
  const content    = document.getElementById("content").value.trim();
  const duration   = parseInt(document.getElementById("duration").value) || 7000;
  const category   = document.getElementById("category").value.trim() || "General";
  const bgtheme    = document.getElementById("bgtheme").value;
  const fullscreen = document.getElementById("fullscreen").checked;

  if (!title) { alert("Please enter a title."); return; }

  let mediaUrl = "";
  if (type === "image") {
    mediaUrl = resolvedImageUrl || document.getElementById("image-url-input").value.trim();
    if (!mediaUrl) { alert("Please upload an image or paste an image URL."); return; }
  }
  if (type === "video") {
    mediaUrl = resolvedVideoUrl || document.getElementById("video-url-input").value.trim();
    if (!mediaUrl) { alert("Please upload a video or paste a video URL."); return; }
  }

  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  document.getElementById("save-btn-text").textContent = editingId ? "Updating…" : "Saving…";

  const postData = { title, content, type, mediaUrl, duration, category, bgtheme, fullscreen, updatedAt: Date.now() };

  try {
    if (editingId) {
      await update(ref(db, "posts/" + editingId), postData);
    } else {
      postData.createdAt = Date.now();
      await push(postsRef, postData);
    }
    clearForm();
  } catch (err) {
    alert("Save failed: " + err.message);
  } finally {
    btn.disabled = false;
    document.getElementById("save-btn-text").textContent = editingId ? "Update Slide" : "Save Slide";
  }
};

// ── EDIT ─────────────────────────────────────────────────────────────────────
function editPost(key) {
  const item = allPosts.find(p => p._key === key);
  if (!item) return;

  editingId = key;
  document.querySelector(`input[name="type"][value="${item.type || "text"}"]`).checked = true;
  onTypeChange();

  document.getElementById("title").value            = item.title    || "";
  document.getElementById("content").value          = item.content  || "";
  document.getElementById("duration").value         = item.duration || "";
  document.getElementById("category").value         = item.category || "";
  document.getElementById("bgtheme").value          = item.bgtheme  || "blue";
  document.getElementById("fullscreen").checked     = item.fullscreen || false;

  if (item.type === "image" && item.mediaUrl) {
    resolvedImageUrl = item.mediaUrl;
    document.getElementById("image-url-input").value = item.mediaUrl;
    if (window.showImagePreviewFromUrl) window.showImagePreviewFromUrl(item.mediaUrl);
  }
  if (item.type === "video" && item.mediaUrl) {
    resolvedVideoUrl = item.mediaUrl;
    document.getElementById("video-url-input").value = item.mediaUrl;
    if (window.showVideoPreviewFromUrl) window.showVideoPreviewFromUrl(item.mediaUrl);
  }

  document.getElementById("form-mode-label").textContent = "✏️ Editing Slide";
  document.getElementById("save-btn-text").textContent   = "Update Slide";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ── DELETE ────────────────────────────────────────────────────────────────────
function deletePost(key) {
  if (confirm("Delete this slide?")) remove(ref(db, "posts/" + key));
}

// ── CLEAR FORM ────────────────────────────────────────────────────────────────
window.clearForm = function () {
  editingId = null;
  document.getElementById("title").value        = "";
  document.getElementById("content").value      = "";
  document.getElementById("duration").value     = "";
  document.getElementById("category").value     = "";
  document.getElementById("bgtheme").value      = "blue";
  document.getElementById("fullscreen").checked = false;
  document.getElementById("image-url-input").value = "";
  document.getElementById("video-url-input").value = "";

  // Reset image drop zone
  const imgPrev = document.getElementById("image-preview");
  imgPrev.src = ""; imgPrev.style.display = "none";
  document.getElementById("image-drop-inner").style.display = "";
  document.getElementById("image-clear-btn").style.display  = "none";
  document.getElementById("image-file-input").value         = "";

  // Reset video drop zone
  const vidPrev = document.getElementById("video-preview");
  vidPrev.src = ""; vidPrev.load(); vidPrev.style.display   = "none";
  document.getElementById("video-drop-inner").style.display = "";
  document.getElementById("video-clear-btn").style.display  = "none";
  document.getElementById("video-file-input").value         = "";

  resolvedImageUrl = "";
  resolvedVideoUrl = "";
  document.querySelector('input[name="type"][value="text"]').checked = true;
  onTypeChange();
  document.getElementById("form-mode-label").textContent = "✨ New Slide";
  document.getElementById("save-btn-text").textContent   = "Save Slide";
};

// ── TYPE CHANGE ───────────────────────────────────────────────────────────────
window.onTypeChange = function () {
  const type = getType();
  document.getElementById("content-group").style.display = type === "text"  ? "" : "none";
  document.getElementById("image-group").style.display   = type === "image" ? "" : "none";
  document.getElementById("video-group").style.display   = type === "video" ? "" : "none";
  document.getElementById("bgcolor-group").style.display = type === "text"  ? "" : "none";
};

function getType() {
  return document.querySelector('input[name="type"]:checked').value;
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
function loadNotifications() {
  onValue(ref(db, "notifications"), (snapshot) => {
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
        <div class="notif-name">👤 ${escHtml(n.name)}</div>
        <div class="notif-email">${escHtml(n.email)}</div>
        <div class="notif-reason">"${escHtml(n.reason)}"</div>
        <div class="notif-actions">
          <button class="btn-approve" data-uid="${uid}">✅ Approve</button>
          <button class="btn-reject"  data-uid="${uid}">❌ Reject</button>
        </div>`;
      card.querySelector(".btn-approve").addEventListener("click", () => approveUser(uid));
      card.querySelector(".btn-reject").addEventListener("click",  () => rejectUser(uid));
      list.appendChild(card);
    });
    if (count === 0) {
      list.innerHTML = '<p class="empty-state">No pending requests</p>';
      badge.style.display = "none";
    } else {
      badge.textContent   = count;
      badge.style.display = "flex";
    }
  });
}

async function approveUser(uid) {
  await update(ref(db, "users/" + uid),         { status: "approved" });
  await update(ref(db, "notifications/" + uid), { status: "read", notifStatus: "read" });
}
async function rejectUser(uid) {
  await update(ref(db, "users/" + uid),         { status: "rejected" });
  await update(ref(db, "notifications/" + uid), { status: "read", notifStatus: "read" });
}

window.toggleNotifications = () => {
  document.getElementById("notif-panel").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("open");
};

window.logoutUser = async () => {
  await signOut(auth);
  window.location.href = "login.html";
};

// ── CLOUDINARY UPLOAD ─────────────────────────────────────────────────────────
async function uploadToCloudinary(file, resourceType, barId, lblId, wrapId) {
  const wrap  = document.getElementById(wrapId);
  const bar   = document.getElementById(barId);
  const label = document.getElementById(lblId);
  wrap.style.display = "flex";
  bar.style.width    = "0%";
  label.textContent  = "Uploading…";

  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    wrap.style.display = "none";
    alert("⚠️ Cloudinary not configured.\nOpen admin.js and set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.\nYou can paste a direct URL instead.");
    return null;
  }

  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        bar.style.width   = pct + "%";
        label.textContent = `Uploading… ${pct}%`;
      }
    };
    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        bar.style.width   = "100%";
        label.textContent = "✅ Upload complete!";
        setTimeout(() => { wrap.style.display = "none"; }, 2000);
        resolve(data.secure_url);
      } else {
        label.textContent = "❌ Upload failed";
        reject(new Error("Upload failed: " + xhr.responseText));
      }
    };
    xhr.onerror = () => { label.textContent = "❌ Network error"; reject(new Error("Network error")); };
    xhr.send(fd);
  });
}

// ── DROP ZONES ────────────────────────────────────────────────────────────────
function setupDropZones() {
  setupOne({
    zoneId: "image-drop-zone", inputId: "image-file-input",
    previewId: "image-preview", innerId: "image-drop-inner", clearId: "image-clear-btn",
    wrapId: "image-progress", barId: "image-progress-bar", lblId: "image-progress-label",
    resource: "image", accept: "image", maxMb: 10,
    onUrl: (url) => { resolvedImageUrl = url; },
    exposePreview: "showImagePreviewFromUrl", isVideo: false,
  });
  setupOne({
    zoneId: "video-drop-zone", inputId: "video-file-input",
    previewId: "video-preview", innerId: "video-drop-inner", clearId: "video-clear-btn",
    wrapId: "video-progress", barId: "video-progress-bar", lblId: "video-progress-label",
    resource: "video", accept: "video", maxMb: 100,
    onUrl: (url) => { resolvedVideoUrl = url; },
    exposePreview: "showVideoPreviewFromUrl", isVideo: true,
  });

  document.getElementById("image-url-input").addEventListener("input", function () {
    resolvedImageUrl = this.value.trim();
    if (resolvedImageUrl && window.showImagePreviewFromUrl)
      window.showImagePreviewFromUrl(resolvedImageUrl);
  });
  document.getElementById("video-url-input").addEventListener("input", function () {
    resolvedVideoUrl = this.value.trim();
    if (resolvedVideoUrl && window.showVideoPreviewFromUrl)
      window.showVideoPreviewFromUrl(resolvedVideoUrl);
  });
}

function setupOne({ zoneId, inputId, previewId, innerId, clearId,
    wrapId, barId, lblId, resource, accept, maxMb, onUrl, exposePreview, isVideo }) {
  const zone    = document.getElementById(zoneId);
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const inner   = document.getElementById(innerId);
  const clearBtn= document.getElementById(clearId);

  zone.addEventListener("click",     (e) => { if (e.target !== clearBtn) input.click(); });
  zone.addEventListener("dragover",  (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", ()  => zone.classList.remove("drag-over"));
  zone.addEventListener("drop",      (e) => {
    e.preventDefault(); zone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  input.addEventListener("change", () => { if (input.files[0]) handleFile(input.files[0]); });
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    preview.style.display  = "none";
    inner.style.display    = "";
    clearBtn.style.display = "none";
    input.value            = "";
    if (isVideo) { preview.src = ""; preview.load(); } else { preview.src = ""; }
    onUrl("");
  });

  async function handleFile(file) {
    if (!file.type.startsWith(accept + "/")) { alert(`Please select a ${accept} file.`); return; }
    if (file.size > maxMb * 1024 * 1024)     { alert(`File too large. Max ${maxMb} MB.`); return; }
    const local = URL.createObjectURL(file);
    showPrev(local);
    try {
      const url = await uploadToCloudinary(file, resource, barId, lblId, wrapId);
      onUrl(url || local);
      if (url) { if (isVideo) { preview.src = url; preview.load(); } else { preview.src = url; } }
    } catch (err) { alert("Upload failed: " + err.message); }
  }

  function showPrev(url) {
    inner.style.display    = "none";
    clearBtn.style.display = "";
    if (isVideo) { preview.src = url; preview.load(); } else { preview.src = url; }
    preview.style.display  = "";
  }

  window[exposePreview] = (url) => {
    inner.style.display    = "none";
    clearBtn.style.display = "";
    if (isVideo) { preview.src = url; preview.load(); } else { preview.src = url; }
    preview.style.display  = "";
  };
}
