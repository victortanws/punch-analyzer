# 🥊 Punch Power Analyzer

An AI-powered web app that analyzes and scores your punching technique in real-time!

## Features
- Real-time pose tracking using MediaPipe
- Live "Body detected" indicator so you know tracking is working before you punch
- Scores based on:
  - **Speed** - How fast your punch is (time- and body-scale normalized, so it's fair on any device and at any distance from the camera)
  - **Power** - How far your fist travels toward the camera
  - **Extension** - Arm straightness at the moment of impact
  - **Hip Rotation** - Proper body mechanics
  - **Form (Guard Up)** - Is your other hand protecting your face?
  - **Battle Cry** - Did you shout louder than the room? 💪 (optional — works without a mic too)
- Personal best tracking and social sharing

## Try It Live
[Click here to try it!](https://victortanws.github.io/punch-analyzer/)

## How to Use
1. Open the web app in your browser (Chrome or Edge recommended)
2. Click "Start Camera" and allow camera/microphone access (mic is optional)
3. Press <kbd>P</kbd> (or click "Ready to Punch"), then step back into position — you have 5 seconds
4. Check the green "Body detected" badge: shoulders and punching arm in frame is enough
5. Throw your best punch after the countdown!

## Troubleshooting
- **No "Body detected" badge?** Make sure your shoulders and at least one full arm are in frame; improve lighting; use a plain background.
- **Page says the AI library failed to load?** Check your internet connection — the pose model loads from a CDN.
- **Camera error?** The page must be served over HTTPS (GitHub Pages is) or opened as a local file in Chrome/Edge.

## Technologies Used
- MediaPipe Pose Detection
- HTML5 Canvas
- Web Audio API
- Vanilla JavaScript

## Local Development
Simply open `punchanalyzer.html` in your browser - no build process needed! (`index.html` just redirects to it so the root GitHub Pages URL works.)

## License
MIT License - Feel free to use and modify!
