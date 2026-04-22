import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { ref, push, onValue, remove, update, get }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// ── CLOUDINARY CONFIG ─────────────────────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME  = "dmzmkkhao";
const CLOUDINARY_UPLOAD_PRESET = "lckingcg"; 
// ─────────────────────────────────────────────────────────────────────────────

const postsRef = ref(db, "posts");
let editingId     = null;
let allPosts      = [];
let currentFilter = "all";
let resolvedImageUrl = ""; // final URL after upload or paste
let resolvedVideoUrl = "";

// ── AUTH GUARD ────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "login.html"; return; }
  const snap = await get(ref(db, "users/" + user.uid));
  if (!snap.exists() || snap.val().status !== "approved") {
    await signOut(auth); window.location.href = "login.html"; return;
  }
  document.getElementById("user-label").textContent = user.email;
  loadNotifications();
  setupDropZones();
});

// ── LOGOUT ────────────────────────────────────────────────────────────────────
window.logoutUser = async function () {
  await signOut(auth);
  window.location.href = "login.html";
};

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
      const n = child.val(); const uid = child.key;
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
    } else { badge.textContent = count; badge.style.display = "flex"; }
  });
}

window.approveUser = async (uid) => {
  await update(ref(db, "users/" + uid), { status: "approved" });
  await update(ref(db, "notifications/" + uid), { status: "read", notifStatus: "read" });
};
window.rejectUser = async (uid) => {
  await update(ref(db, "users/" + uid), { status: "rejected" });
  await update(ref(db, "notifications/" + uid), { status: "read", notifStatus: "read" });
};
window.toggleNotifications = () => {
  document.getElementById("notif-panel").classList.toggle("open");
  document.getElementById("overlay").classList.toggle("open");
};

// ── TYPE CHANGE ───────────────────────────────────────────────────────────────
window.onTypeChange = function () {
  const type = getType();
  document.getElementById("content-group").style.display  = type === "text"  ? "" : "none";
  document.getElementById("image-group").style.display    = type === "image" ? "" : "none";
  document.getElementById("video-group").style.display    = type === "video" ? "" : "none";
  document.getElementById("bgcolor-group").style.display  = type === "text"  ? "" : "none";
};

function getType() {
  return document.querySelector('input[name="type"]:checked').value;
}

// ── CLOUDINARY UPLOAD ─────────────────────────────────────────────────────────
async function uploadToCloudinary(file, resourceType, progressBarId, progressLabelId, progressWrapperId) {
  const wrap  = document.getElementById(progressWrapperId);
  const bar   = document.getElementById(progressBarId);
  const label = document.getElementById(progressLabelId);
  wrap.style.display = "flex";
  bar.style.width = "0%";
  label.textContent = "Uploading…";

  if (CLOUDINARY_CLOUD_NAME === "YOUR_CLOUD_NAME") {
    wrap.style.display = "none";
    alert("⚠️ Cloudinary is not configured.\n\nOpen admin.js and set your CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET.\n\nYou can still paste a direct URL instead.");
    return null;
  }

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        bar.style.width = pct + "%";
        label.textContent = `Uploading… ${pct}%`;
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        bar.style.width = "100%";
        label.textContent = "✅ Upload complete!";
        setTimeout(() => { wrap.style.display = "none"; }, 2000);
        resolve(data.secure_url);
      } else {
        label.textContent = "❌ Upload failed";
        reject(new Error("Upload failed: " + xhr.responseText));
      }
    };

    xhr.onerror = () => { label.textContent = "❌ Network error"; reject(new Error("Network error")); };
    xhr.send(formData);
  });
}

// ── DROP ZONE SETUP ───────────────────────────────────────────────────────────
function setupDropZones() {
  setupDropZone({
    zoneId:       "image-drop-zone",
    inputId:      "image-file-input",
    previewId:    "image-preview",
    innerWrappId: "image-drop-inner",
    clearBtnId:   "image-clear-btn",
    progressWrap: "image-progress",
    progressBar:  "image-progress-bar",
    progressLbl:  "image-progress-label",
    resourceType: "image",
    accept:       "image",
    maxMb:        10,
    onResolved:   (url) => { resolvedImageUrl = url; },
  });

  setupDropZone({
    zoneId:       "video-drop-zone",
    inputId:      "video-file-input",
    previewId:    "video-preview",
    innerWrappId: "video-drop-inner",
    clearBtnId:   "video-clear-btn",
    progressWrap: "video-progress",
    progressBar:  "video-progress-bar",
    progressLbl:  "video-progress-label",
    resourceType: "video",
    accept:       "video",
    maxMb:        100,
    onResolved:   (url) => { resolvedVideoUrl = url; },
  });

  // URL paste listeners
  document.getElementById("image-url-input").addEventListener("input", function () {
    resolvedImageUrl = this.value.trim();
    if (resolvedImageUrl) showImagePreviewFromUrl(resolvedImageUrl);
  });

  document.getElementById("video-url-input").addEventListener("input", function () {
    resolvedVideoUrl = this.value.trim();
    if (resolvedVideoUrl) showVideoPreviewFromUrl(resolvedVideoUrl);
  });
}

function setupDropZone({ zoneId, inputId, previewId, innerWrappId, clearBtnId,
    progressWrap, progressBar, progressLbl, resourceType, accept, maxMb, onResolved }) {
  const zone      = document.getElementById(zoneId);
  const input     = document.getElementById(inputId);
  const preview   = document.getElementById(previewId);
  const inner     = document.getElementById(innerWrappId);
  const clearBtn  = document.getElementById(clearBtnId);
  const isVideo   = resourceType === "video";

  // Click zone → open file picker
  zone.addEventListener("click", (e) => {
    if (e.target === clearBtn) return;
    input.click();
  });

  // File selected via picker
  input.addEventListener("change", () => {
    if (input.files[0]) handleFile(input.files[0]);
  });

  // Drag events
  zone.addEventListener("dragover",  (e) => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", ()  => zone.classList.remove("drag-over"));
  zone.addEventListener("drop",      (e) => {
    e.preventDefault(); zone.classList.remove("drag-over");
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });

  // Clear button
  clearBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    preview.style.display = "none";
    inner.style.display   = "flex";
    clearBtn.style.display = "none";
    input.value = "";
    if (isVideo) { preview.src = ""; preview.load(); }
    else           { preview.src = ""; }
    onResolved("");
  });

  async function handleFile(file) {
    // Validate type & size
    if (!file.type.startsWith(accept + "/")) {
      alert(`Please select a ${accept} file.`); return;
    }
    if (file.size > maxMb * 1024 * 1024) {
      alert(`File is too large. Max ${maxMb} MB.`); return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    showPreview(localUrl);

    // Upload to Cloudinary
    try {
      const cloudUrl = await uploadToCloudinary(file, resourceType, progressBar, progressLbl, progressWrap);
      if (cloudUrl) {
        onResolved(cloudUrl);
        // Update preview to cloudinary URL
        if (isVideo) { preview.src = cloudUrl; }
        else          { preview.src = cloudUrl; }
      } else {
        // Cloudinary not configured — keep local blob URL as fallback
        onResolved(localUrl);
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Upload failed: " + err.message);
    }
  }

  function showPreview(url) {
    inner.style.display   = "none";
    clearBtn.style.display = "";
    if (isVideo) {
      preview.src = url;
      preview.load();
    } else {
      preview.src = url;
    }
    preview.style.display = "";
  }

  // Expose for URL paste
  if (isVideo) {
    window.showVideoPreviewFromUrl = (url) => {
      inner.style.display   = "none";
      clearBtn.style.display = "";
      preview.src = url; preview.load();
      preview.style.display = "";
    };
  } else {
    window.showImagePreviewFromUrl = (url) => {
      inner.style.display   = "none";
      clearBtn.style.display = "";
      preview.src = url;
      preview.style.display = "";
    };
  }
}

// ── SAVE / UPDATE ─────────────────────────────────────────────────────────────
window.savePost = async function () {
  const type     = getType();
  const title    = document.getElementById("title").value.trim();
  const content  = document.getElementById("content").value.trim();
  const duration = parseInt(document.getElementById("duration").value) || 7000;
  const category = document.getElementById("category").value.trim() || "General";
  const bgtheme  = document.getElementById("bgtheme").value;
  const fullscreen = document.getElementById("fullscreen").checked;

  if (!title) { alert("Please enter a title."); return; }

  // Determine media URL
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

  const postData = { title, content, type, mediaUrl, duration, category, bgtheme, fullscreen, updatedAt: Date.now() };

  if (editingId) {
    await update(ref(db, "posts/" + editingId), postData);
    editingId = null;
    document.getElementById("form-mode-label").textContent = "✨ New Slide";
    document.getElementById("save-btn-text").textContent   = "Save Slide";
  } else {
    postData.createdAt = Date.now();
    await push(postsRef, postData);
  }

  btn.disabled = false;
  clearForm();
};

// ── FILTER ───────────────────────────────────────────────────────────────────
window.filterSlides = function (type, btn) {
  currentFilter = type;
  document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  renderPosts(allPosts);
};

// ── LOAD POSTS ────────────────────────────────────────────────────────────────
onValue(postsRef, (snapshot) => {
  allPosts = [];
  snapshot.forEach(child => allPosts.push({ key: child.key, ...child.val() }));
  document.getElementById("post-count").textContent = allPosts.length;
  renderPosts(allPosts);
});

function renderPosts(posts) {
  const container = document.getElementById("posts");
  const filtered  = currentFilter === "all" ? posts : posts.filter(p => p.type === currentFilter);
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-slides">
      <div class="empty-icon">📭</div>
      <p>${posts.length === 0 ? "No slides yet. Create your first one!" : "No slides match this filter."}</p>
    </div>`;
    return;
  }
  container.innerHTML = "";
  filtered.forEach(data => {
    const card = document.createElement("div");
    card.className = "post-card";
    const typeIcon = data.type === "video" ? "🎥" : data.type === "image" ? "🖼️" : "📝";
    const thumb = (data.type === "image" && data.mediaUrl)
      ? `<img src="${data.mediaUrl}" class="post-thumb" alt="" onerror="this.style.display='none'">`
      : (data.type === "video" && data.mediaUrl)
      ? `<div class="post-thumb" style="background:#000;display:flex;align-items:center;justify-content:center;font-size:22px">🎥</div>`
      : "";
    const safeData = JSON.stringify(data).replace(/'/g, "&#39;").replace(/"/g, "&quot;");
    card.innerHTML = `
      ${thumb}
      <div class="post-info">
        <span class="post-type-badge ${data.type}">${typeIcon} ${data.type.charAt(0).toUpperCase()+data.type.slice(1)}</span>
        <div class="post-title">${data.title}</div>
        <div class="post-meta">${data.category} · ${data.duration || 7000}ms${data.fullscreen ? " · Fullscreen" : ""}</div>
      </div>
      <div class="post-card-actions">
        <button class="btn-edit"   onclick='editPost(${JSON.stringify(data.key)}, JSON.parse(this.dataset.d))' data-d="${safeData}">Edit</button>
        <button class="btn-delete" onclick="deletePost('${data.key}')">Delete</button>
      </div>`;
    container.appendChild(card);
  });
}

// ── EDIT ──────────────────────────────────────────────────────────────────────
window.editPost = function (id, data) {
  editingId = id;
  document.querySelector(`input[name="type"][value="${data.type || "text"}"]`).checked = true;
  onTypeChange();
  document.getElementById("title").value    = data.title    || "";
  document.getElementById("content").value  = data.content  || "";
  document.getElementById("duration").value = data.duration || "";
  document.getElementById("category").value = data.category || "";
  document.getElementById("bgtheme").value  = data.bgtheme  || "blue";
  document.getElementById("fullscreen").checked = data.fullscreen || false;

  if (data.type === "image" && data.mediaUrl) {
    resolvedImageUrl = data.mediaUrl;
    document.getElementById("image-url-input").value = data.mediaUrl;
    if (window.showImagePreviewFromUrl) window.showImagePreviewFromUrl(data.mediaUrl);
  }
  if (data.type === "video" && data.mediaUrl) {
    resolvedVideoUrl = data.mediaUrl;
    document.getElementById("video-url-input").value = data.mediaUrl;
    if (window.showVideoPreviewFromUrl) window.showVideoPreviewFromUrl(data.mediaUrl);
  }

  document.getElementById("form-mode-label").textContent = "✏️ Editing Slide";
  document.getElementById("save-btn-text").textContent   = "Update Slide";
  window.scrollTo({ top: 0, behavior: "smooth" });
};

// ── DELETE ────────────────────────────────────────────────────────────────────
window.deletePost = function (id) {
  if (confirm("Delete this slide?")) remove(ref(db, "posts/" + id));
};

// ── CLEAR ─────────────────────────────────────────────────────────────────────
window.clearForm = function () {
  document.getElementById("title").value    = "";
  document.getElementById("content").value  = "";
  document.getElementById("duration").value = "";
  document.getElementById("category").value = "";
  document.getElementById("bgtheme").value  = "blue";
  document.getElementById("fullscreen").checked = false;
  document.getElementById("image-url-input").value = "";
  document.getElementById("video-url-input").value = "";

  // Reset image zone
  const imgPrev = document.getElementById("image-preview");
  imgPrev.src = ""; imgPrev.style.display = "none";
  document.getElementById("image-drop-inner").style.display = "";
  document.getElementById("image-clear-btn").style.display  = "none";
  document.getElementById("image-file-input").value = "";

  // Reset video zone
  const vidPrev = document.getElementById("video-preview");
  vidPrev.src = ""; vidPrev.load(); vidPrev.style.display = "none";
  document.getElementById("video-drop-inner").style.display = "";
  document.getElementById("video-clear-btn").style.display  = "none";
  document.getElementById("video-file-input").value = "";

  resolvedImageUrl = "";
  resolvedVideoUrl = "";
  editingId = null;
  document.querySelector('input[name="type"][value="text"]').checked = true;
  onTypeChange();
  document.getElementById("form-mode-label").textContent = "✨ New Slide";
  document.getElementById("save-btn-text").textContent   = "Save Slide";
};
