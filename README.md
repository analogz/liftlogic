# 🏋️ LiftLogic

**A hypertrophy-focused workout tracker with real-time leaderboards.**

Track your lifts, monitor progressive overload, and compete with friends on weekly volume.

![LiftLogic Dashboard](https://img.shields.io/badge/PWA-Ready-brightgreen) ![Firebase](https://img.shields.io/badge/Firebase-Enabled-orange) ![License](https://img.shields.io/badge/License-MIT-blue)

---

## 🚀 Quick Start (Friends Edition)

Want to join the leaderboard and start tracking? Here's how:

### Option A: Use the Live App (Easiest)
👉 **[Open LiftLogic](https://analogz.github.io/liftlogic/)** ← Just click and go!

### Option B: Run Locally

**1. Download the app:**
```bash
git clone https://github.com/analogz/liftlogic.git
cd liftlogic
```

**2. Start the server:**
```bash
# Mac/Linux
python3 -m http.server 8080

# Windows
python -m http.server 8080
```

**3. Open in browser:**
```
http://localhost:8080
```

**4. Sign in & compete:**
- Click **"Sign in with Google"** on the Dashboard
- Log your workouts on the Tracker page
- Click **"Sync Stats"** to upload your score
- Check the leaderboard to see how you rank!

### 📱 Install on Your Phone
1. Open the app in Chrome/Safari
2. Tap "Add to Home Screen" 
3. Now it works like a native app — even offline!

---

## ✨ Features

### 📊 Hypertrophy Dashboard
- **Weekly Volume Scorecard** — Track sets per muscle group against research-backed targets (10-20 sets/week)
- **Progressive Overload Tracker** — Stall detection on compound lifts
- **Training Intensity** — RIR (Reps in Reserve) monitoring for optimal hypertrophy

### 💪 Workout Tracker
- Quick exercise logging with weight, reps, and RIR
- Built-in rest timer with presets (60s, 90s, 120s)
- "Start Today's Workout" — auto-loads exercises from your schedule
- Mobile-first design for gym use

### 🏆 Leaderboard (Firebase)
- **Google Sign-In** — Secure authentication
- **Weekly Competition** — Compete with friends on volume score
- **Real-time Sync** — See rankings update live

### 📱 Progressive Web App
- **Install on phone** — Works like a native app
- **Offline support** — Log workouts without internet
- **Auto-backup reminders** — Never lose your data

---

## 🚀 Quick Start

### Option 1: Local Development
```bash
# Clone the repo
git clone git@github.com:analogz/liftlogic.git
cd liftlogic

# Start local server
python3 -m http.server 8080

# Open in browser
open http://localhost:8080
```

### Option 2: Static Hosting
Deploy to any static host (Netlify, Vercel, GitHub Pages, etc.)

---

## 🔥 Firebase Setup (for Leaderboard)

1. Create a project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** → **Google Sign-In**
3. Create **Firestore Database** (start in test mode)
4. Get your config from **Project Settings** → **Your Apps**
5. Update `js/firebase/config.js` with your credentials

### Firestore Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Weekly stats - anyone signed in can read, only owner can write
    match /weeklyStats/{docId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        request.resource.data.odId == request.auth.uid;
    }
  }
}
```

---

## 📁 Project Structure

```
liftlogic/
├── index.html              # Landing page
├── tracker.html            # Workout logging
├── dashboard.html          # Analytics & leaderboard
├── schedule.html           # Weekly program
├── data-explorer.html      # Data management
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker
├── css/
│   ├── theme.css           # Design tokens & base styles
│   ├── modal.css           # Schedule modal styles
│   └── leaderboard.css     # Leaderboard component
├── js/
│   ├── nav.js              # Navigation & modals
│   ├── schedule-data.js    # Workout program (single source of truth)
│   ├── data/
│   │   ├── store.js        # Centralized data management
│   │   └── backup.js       # Backup/restore functionality
│   └── firebase/
│       ├── config.js       # Firebase configuration
│       ├── auth.js         # Google authentication
│       ├── leaderboard.js  # Leaderboard sync
│       └── leaderboard-ui.js
└── dev/
    ├── generate-data.html  # Test data generator
    └── generate-data.js
```

---

## 🎨 Design System

- **Colors**: Dark athletic theme with electric lime accent (`#BFFF00`)
- **Typography**: Outfit (body) + JetBrains Mono (numbers)
- **Spacing**: 8pt grid system
- **Mobile-first**: Bottom navigation, touch-friendly inputs

---

## 📈 Training Philosophy

LiftLogic is built around evidence-based hypertrophy principles:

| Metric | Target | Source |
|--------|--------|--------|
| Weekly sets/muscle | 10-20 | Schoenfeld et al. |
| RIR | 1-3 | Helms et al. |
| Frequency | 2-3x/muscle/week | Meta-analyses |
| Progressive overload | Weekly | Fundamental principle |

---

## 🛠 Development

### Generate Test Data
```bash
open http://localhost:8080/dev/generate-data.html
```

### Clear All Data
```javascript
localStorage.clear();
location.reload();
```

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

## 🙏 Credits

Built with:
- [Chart.js](https://www.chartjs.org/) — Analytics charts
- [Firebase](https://firebase.google.com/) — Auth & database
- [Google Fonts](https://fonts.google.com/) — Outfit & JetBrains Mono

---

**Made with 💪 for lifters who love data.**

