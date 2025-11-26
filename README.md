# ArtWork-Museum

A lightweight web app called **Our Museum** for sketching on a canvas, saving the piece to a tiny JSON-backed datastore, and browsing everyone else's creations.

## Features
- Pressure-free drawing canvas with pen, highlighter, eraser, shape tools (freehand, line, rectangle, ellipse), fill toggle, and optional grid background.
- Quick palette, color picker, opacity + brush size sliders, undo/redo history, clear and new-canvas controls, and PNG downloads.
- Save drawings with a title, artist name, and notes; uploads persist in a simple JSON datastore.
- Gallery wall showing the latest drawings with thumbnails, metadata, load-to-canvas, and download actions.

## Running locally
1. Ensure Node.js 18+ is available (no external npm dependencies are required).
2. Start the server:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000` in your browser and begin drawing.

Drawings are stored in `data/drawings.json` (created automatically on first save and ignored by Git).
