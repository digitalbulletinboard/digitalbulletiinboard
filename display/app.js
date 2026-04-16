import { db } from "../firebase.js";
import { ref, onValue } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

let slides = [];
let currentSlide = 0;
let data = [];

const postsRef = ref(db, "posts");

// FETCH DATA REAL-TIME
onValue(postsRef, (snapshot) => {
  data = [];
  snapshot.forEach(child => {
    data.push(child.val());
  });

  renderSlides();
});

function renderSlides() {
  const container = document.getElementById("slideshow");
  container.innerHTML = "";

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
  showSlide();
}

// FIXED TIMING PER SLIDE
function showSlide() {
  slides.forEach(s => s.classList.remove("active"));
  slides[currentSlide].classList.add("active");

  setTimeout(() => {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide();
  }, data[currentSlide]?.duration || 5000);
}
