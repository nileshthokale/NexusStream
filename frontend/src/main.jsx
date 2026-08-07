import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import VideoPlayer from './components/VideoPlayer.jsx'
import './index.css'

const searchParams = new URLSearchParams(window.location.search);
const isEmbed = window.location.pathname === '/embed';
const embedUrl = searchParams.get('url');

if (isEmbed && embedUrl) {
  // Render just the player for embeds
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <div className="w-screen h-screen bg-black overflow-hidden flex items-center justify-center">
        <VideoPlayer url={embedUrl} proxyEnabled={false} />
      </div>
    </React.StrictMode>,
  )
} else {
  // Render full app
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
