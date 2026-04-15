import { db } from "../firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let slides = [];
let currentSlide = 0;
let data = [];
let timer = null;

function renderSlides() {
  const container = document.getElementById("slideshow");
  container.innerHTML = "";

  if (data.length === 0) return;

  data.forEach((item, index) => {
    const slide = document.createElement("div");
    slide.classList.add("slide");

    if (index === 0) slide.classList.add("active");

    if (item.type === "text") {
      slide.innerHTML = `
        <div class="slide-text">
          <div class="category">${item.category || "ANNOUNCEMENT"}</div>
          <div class="title">${item.title}</div>
          <div class="content">${item.content}</div>
        </div>
      `;
    }

    if (item.type === "video") {
      slide.innerHTML = `
        <video autoplay muted>
          <source src="${item.url}" type="video/mp4">
        </video>
      `;
    }

    container.appendChild(slide);
  });

  slides = document.querySelectorAll(".slide");
  currentSlide = 0;

  startSlideshow(); // start after render
}

function startSlideshow() {
  // CLEAR OLD TIMER (IMPORTANT)
  if (timer) clearTimeout(timer);

  showSlide();
}

function showSlide() {
  if (slides.length === 0) return;

  // REMOVE ALL ACTIVE
  slides.forEach(s => s.classList.remove("active"));

  // SHOW CURRENT
  slides[currentSlide].classList.add("active");

  // GET CURRENT DURATION SAFELY
  const duration = data[currentSlide]?.duration || 5000;

  // SET NEXT
  timer = setTimeout(() => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide();
  }, duration);
}
