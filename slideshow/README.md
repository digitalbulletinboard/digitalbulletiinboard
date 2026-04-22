# 📋 Digital Bulletin Board — Slideshow System

A fullscreen digital bulletin board with a real-time admin panel, live weather, and Firebase integration. Deployable to GitHub Pages with zero backend.

---

## 📁 File Structure

```
slideshow/
├── index.html       → Redirects to login
├── login.html       → Sign in / Request Access
├── admin.html       → Admin panel (CRUD for slides)
├── admin.css        → Admin styles
├── admin.js         → Admin logic (Firebase CRUD)
├── display.html     → Fullscreen slideshow display
├── firebase.js      → Firebase shared config
└── README.md
```

---

## 🚀 Quick Setup

### 1. Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project (or use existing `digitalbulletinboard-54f06`)
3. **Enable Authentication** → Sign-in method → Email/Password → Enable
4. **Create Realtime Database** → Start in test mode
   - Set `databaseURL` to your region URL (Asia Southeast: `asia-southeast1`)
5. **Set Database Rules:**
   ```json
   {
     "rules": {
       "posts": { ".read": true, ".write": "auth != null" },
       "users": {
         "$uid": {
           ".read": "auth != null && auth.uid == $uid || auth != null",
           ".write": "auth != null"
         }
       },
       "notifications": { ".read": "auth != null", ".write": "auth != null" }
     }
   }
   ```

### 2. First Admin Setup

1. Open `login.html` → go to **Request Access** tab
2. Fill in your details and submit
3. Go to Firebase Console → Realtime Database → `users` → find your UID
4. Change `status` from `"pending"` to `"approved"`
5. Now you can sign in!

### 3. OpenWeatherMap API Key

1. Sign up at [openweathermap.org](https://openweathermap.org/api) (free tier)
2. Get your API key
3. Open `display.html` and replace line:
   ```js
   const OWM_API_KEY = "YOUR_OPENWEATHERMAP_API_KEY";
   ```
   With your actual key.
4. Change `OWM_CITY` to your city name.

---

## 🌐 Deploy to GitHub Pages

1. Create a new GitHub repository (public)
2. Push the `slideshow/` folder contents to the repo root
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. Go to **Settings → Pages** → Source: `main` branch → `/root`
4. Your site will be live at: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

> **Important:** GitHub Pages serves static files only — Firebase handles all dynamic data.

---

## 🖥️ Display URL

The display page is meant to be opened fullscreen on a TV/monitor:
- URL: `display.html`
- Press `F11` for fullscreen mode
- Click anywhere to skip to next slide

---

## ✨ Slide Types

| Type  | Description |
|-------|-------------|
| 📝 Text  | Title, body text, accent color theme |
| 🖼️ Image | Full-bleed image with caption overlay |
| 🎥 Video | Full-bleed autoplay video (advances on end) |

---

## 📦 Features

- ✅ Firebase Realtime Database sync (live updates)
- ✅ User authentication with admin approval workflow
- ✅ Access request notifications panel
- ✅ CRUD for slides (create, edit, delete)
- ✅ Filter slides by type in admin
- ✅ Live clock with seconds
- ✅ 7-day mini calendar strip
- ✅ OpenWeatherMap live weather (temp, humidity, wind)
- ✅ Smooth slide transitions with progress bar
- ✅ Video slides advance on video end
- ✅ Color themes per text slide
- ✅ Mobile-responsive admin panel
