
import { db } from "../firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const postsRef = ref(db, "posts");

let slides = [];
let currentSlide = 0;
let data = [];
let timer = null;

// 🟢 PROGRESS BAR SETUP
function createProgressBar() {
  const progressBar = document.createElement('div');
  progressBar.className = 'progress-bar';
  document.body.appendChild(progressBar);
  return progressBar;
}

const progressBar = createProgressBar();

// 🔥 FIREBASE DATA LISTENER
onValue(postsRef, (snapshot) => {
  console.log("🔥 Firebase snapshot received");
  
  data = [];
  if (!snapshot.exists()) {
    console.log("No data found");
    return;
  }

  snapshot.forEach(child => {
    data.push(child.val());
  });

  console.log("✅ Loaded", data.length, "slides:", data);
  renderSlides();
});

// 🖼️ RENDER ALL SLIDES
function renderSlides() {
  const container = document.getElementById("slideshow");
  if (!container) {
    console.error("❌ #slideshow container NOT FOUND!");
    return;
  }
  
  container.innerHTML = ""; // Clear
  
  if (data.length === 0) {
    container.innerHTML = '<div style="color:#666; text-align:center; padding-top:50vh;">Loading slides...</div>';
    return;
  }

  data.forEach((item, index) => {
    const slide = document.createElement("div");
    slide.classList.add("slide");
    if (index === 0) slide.classList.add("active");

    // 📝 TEXT SLIDE
    if (item.type === "text") {
      slide.innerHTML = `
        <div class="slide-text">
          <div class="category">${item.category || "ANNOUNCEMENT"}</div>
          <div class="title">${item.title || "No Title"}</div>
          <div class="content">${item.content || "No content available"}</div>
        </div>
      `;
    }
    
    // 🎥 VIDEO SLIDE
    else if (item.type === "video") {
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.innerHTML = `<source src="${item.url}" type="video/mp4">`;
      slide.appendChild(video);
    }

    container.appendChild(slide);
  });

  slides = document.querySelectorAll(".slide");
  console.log("🎨 Rendered", slides.length, "slides");
  
  currentSlide = 0;
  startSlideshow();
}

// ▶️ START SLIDESHOW LOOP
function startSlideshow() {
  if (timer) clearTimeout(timer);
  showSlide(currentSlide);
}

// 🔄 SHOW SINGLE SLIDE
function showSlide(index) {
  if (slides.length === 0) return;

  console.log(`📱 Showing slide ${index + 1}/${slides.length}`);

  // Hide all slides + pause videos
  slides.forEach((slide, i) => {
    slide.classList.remove("active");
    
    // Pause non-active videos
    const video = slide.querySelector('video');
    if (video && i !== index) {
      video.pause();
      video.currentTime = 0;
    }
  });

  // Activate current slide
  slides[index].classList.add("active");
  
  // Play current video
  const currentVideo = slides[index].querySelector('video');
  if (currentVideo) {
    currentVideo.play().catch(e => {
      console.log("🎥 Video autoplay blocked:", e);
    });
  }

  // Get duration (fallback 7s)
  const duration = Number(data[index]?.duration) || 7000;
  
  // Progress bar animation
  progressBar.style.width = '0%';
  progressBar.style.transition = `none`;
  requestAnimationFrame(() => {
    progressBar.style.transition = `width ${duration}ms linear`;
    progressBar.style.width = '100%';
  });

  // Schedule next slide
  timer = setTimeout(() => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }, duration);
}

// 🖱️ OPTIONAL: Click to next slide
document.addEventListener('click', () => {
  if (timer) {
    clearTimeout(timer);
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
  }
});

console.log("🎬 Slideshow app loaded!");