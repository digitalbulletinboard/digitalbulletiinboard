import { db } from "../firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const postsRef = ref(db, "posts");

let slides = [];
let currentSlide = 0;
let data = [];
let timer = null;

// 🔥 FETCH DATA FROM FIREBASE
onValue(postsRef, (snapshot) => {
  data = [];

  if (!snapshot.exists()) {
    console.log("No data found");
    return;
  }

  snapshot.forEach(child => {
    data.push(child.val());
  });

  console.log("DATA:", data); // DEBUG

  renderSlides();
});

// 🧩 RENDER SLIDES
function renderSlides() {
  const container = document.getElementById("slideshow");
  container.innerHTML = "";

  if (data.length === 0) return;

  data.forEach((item, index) => {
    const slide = document.createElement("div");
    slide.classList.add("slide");

    if (index === 0) slide.classList.add("active");

    // TEXT
    if (item.type === "text") {
      slide.innerHTML = `
        <div class="slide-text">
          <div class="category">${item.category || "ANNOUNCEMENT"}</div>
          <div class="title">${item.title || ""}</div>
          <div class="content">${item.content || ""}</div>
        </div>
      `;
    }

    // VIDEO
    if (item.type === "video") {
      slide.innerHTML = `
        <video autoplay muted playsinline>
          <source src="${item.url}" type="video/mp4">
        </video>
      `;
    }

    container.appendChild(slide);
  });

  slides = document.querySelectorAll(".slide");
  currentSlide = 0;

  startSlideshow(); // 🔥 IMPORTANT
}

// 🔁 START SLIDESHOW
function startSlideshow() {
  if (timer) {
    clearTimeout(timer); // prevent multiple loops
  }

  showSlide();
}

// 🎯 MAIN LOOP
function showSlide() {
  if (slides.length === 0) return;

  // REMOVE ACTIVE
  slides.forEach(s => s.classList.remove("active"));

  // SHOW CURRENT
  slides[currentSlide].classList.add("active");

  // GET DURATION SAFELY
  const duration = Number(data[currentSlide]?.duration) || 5000;

  console.log("Slide:", currentSlide, "Duration:", duration);

  // NEXT SLIDE
  timer = setTimeout(() => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide();
  }, duration);
}
