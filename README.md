<div align="center">

# NexusStream

### Universal Video Streaming Web App

A modern, responsive video streaming application built with **React**, **Tailwind CSS**, and **Vite**. Paste any video URL and instantly stream it with a premium player interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-red.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://reactjs.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite)](https://vitejs.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)

</div>

---

## Features

- **Universal Playback** — Stream `.mp4`, `.webm`, `.ogg`, HLS (`.m3u8`), DASH (`.mpd`), YouTube, and Vimeo URLs
- **Auto-Detection** — Automatically detects URL type and switches between HTML5 Video, hls.js, dash.js, and ReactPlayer
- **CORS Proxy** — Built-in Express proxy server to bypass cross-origin restrictions
- **Quality Selector** — Manually pick resolution or leave it on Auto for adaptive bitrate
- **Playback Speed Control** — Adjust speed from 0.5x to 10x
- **Stream History** — Stores recently played URLs in localStorage for quick access
- **Keyboard Shortcuts** — Space (play/pause), Arrow Left/Right (skip 15s)
- **Embed Mode** — Generate iframe embed codes for external sites
- **Picture-in-Picture** — Pop out the video into a floating window
- **Fullscreen** — Double-click or button to toggle fullscreen
- **Mobile Responsive** — Optimized for all screen sizes

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 19, Vite 8, Tailwind CSS 3 |
| **Video Libraries** | hls.js, dash.js, react-player |
| **Icons** | lucide-react |
| **Backend** | Node.js, Express 5, axios |
| **Proxy** | http-proxy-middleware |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### Installation

1. **Clone the repository**

```bash
git clone https://github.com/your-username/NexusStream.git
cd NexusStream
```

2. **Install Backend Dependencies**

```bash
cd backend
npm install
```

3. **Install Frontend Dependencies**

```bash
cd ../frontend
npm install
```

### Running the App

Start both servers in separate terminals:

**Terminal 1 — Backend (CORS Proxy):**

```bash
cd backend
npm start
```

> Server runs on `http://localhost:5000`

**Terminal 2 — Frontend (React UI):**

```bash
cd frontend
npm run dev
```

> App runs on `http://localhost:5173`

---

## Usage

1. **Paste a URL** into the input field (supports `.mp4`, `.m3u8`, `.mpd`, YouTube, Vimeo)
2. **Click Play** to start streaming
3. **Enable CORS Proxy** toggle if the video fails to load due to cross-origin restrictions
4. **Copy Embed** to get an `<iframe>` snippet for embedding on other sites
5. **Browse History** to quickly replay previous streams

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Arrow Left` | Skip backward 15s |
| `Arrow Right` | Skip forward 15s |

---

## Project Structure

```
NexusStream/
├── frontend/                  # React (Vite) application
│   ├── src/
│   │   ├── components/
│   │   │   └── VideoPlayer.jsx   # Custom video player component
│   │   ├── App.jsx               # Main UI with URL input & history
│   │   ├── main.jsx              # Entry point (App vs Embed routing)
│   │   └── index.css             # Tailwind directives & animations
│   ├── public/
│   │   └── favicon.svg
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── backend/                   # Node.js + Express CORS Proxy
│   ├── server.js              # Proxy endpoint (/proxy?url=...)
│   └── package.json
│
├── LICENSE                    # MIT License
├── CONTRIBUTING.md            # Contribution guidelines
└── README.md
```

---

## API

### `GET /proxy?url=<video-url>`

Proxies a video stream request to bypass CORS restrictions.

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | The video URL to proxy |

**Example:**

```
http://localhost:5000/proxy?url=https://example.com/video.mp4
```

Supports range requests for seeking in large video files.

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with React, Tailwind CSS & Vite**

</div>
