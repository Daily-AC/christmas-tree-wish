# 🎄 Interactive Particle Christmas Tree (For YingYing)

A romantic, interactive 3D particle Christmas tree web application, built with **Three.js** and **MediaPipe**. Designed as a special Christmas gift, it features hand gesture controls, photo memories, and personalized romantic effects.

## ✨ Features

### 🌟 Interactive Modes

- **✊ Fist (Tree Mode)**: Particles assemble into a rotating Christmas tree.
- **🖐️ Open Hand (Scatter Mode)**: Particles explode into a galaxy-like swirl with inertial rotation.
- **👌 Pinch (Focus Mode)**: Selects a photo from your memories to display front and center, while the background fades away (optimized for focus).

### 📱 Mobile Optimized

- **Smart Adaptation**: Automatically detects mobile devices.
- **Performance Mode**: Switches AI inference to CPU and reduces particle count/effects for smooth 30-60 FPS experience on phones.
- **Touch Controls**: Tap anywhere to hide/show the UI.
- **Front Camera Priority**: Defaults to selfie mode for easy interaction.

### 💖 "YingYing" Special Edition

- **Custom Title**: "Merry Christmas, My YingYing".
- **Heart Particles**: Thousands of pink 3D hearts replace standard dust particles.
- **Love Easter Egg**: Type **"ying"** on the keyboard (or tap 4 times in sequence if customized) to trigger a full-screen "Love Explosion" effect!

### 🖼️ Dynamic Photo Wall

- **Local Loading**: Automatically loads `1.jpg` through `30.jpg` from the `resources/` folder.
- **Manual Upload**: Support for uploading additional photos via the UI.

## 🚀 How to Run

### 1. Prerequisites

- Python (for simple HTTP server) or any web server (VS Code Live Server, etc.).
- **SSL/HTTPS is required for mobile camera access** (or use localhost with port forwarding).

### 2. Start Locally

Open a terminal in the project folder:

```bash
python -m http.server 1428
# Access at http://localhost:1428
```

### 3. Mobile Access (Port Forwarding)

To play on your phone while connected to your PC:

1. Connect phone via USB.
2. Open Chrome DevTools (`F12`) -> **Remote Devices** (or `chrome://inspect`).
3. Set up **Port Forwarding**: `1428` -> `localhost:1428`.
4. On your phone, open `localhost:1428` in Chrome.

## 🛠️ Customization

### Adding Photos

1. Put your photos in the `resources/` folder.
2. Run the included Python script to rename them automatically:
   ```bash
   python rename_resources.py
   ```
   _This will rename files to `1.jpg`, `2.jpg`... for auto-loading._

### Tech Stack

- **Three.js**: 3D Rendering (Particles, Bloom, Physics).
- **MediaPipe**: Hand Tracking & Gesture Recognition.
- **Vanilla JS**: No heavy frameworks, single `index.html` architecture.

---

_Merry Christmas! 🎅_
