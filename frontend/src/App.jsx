import React, { useState, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import { Play, Link as LinkIcon, Copy, History, Trash2, Server, MonitorPlay, ChevronDown, ExternalLink, Check } from 'lucide-react';

function App() {
  const [urlInput, setUrlInput] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [history, setHistory] = useState([]);
  const [proxyEnabled, setProxyEnabled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const savedHistory = localStorage.getItem('videoHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const handlePlay = (e) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setCurrentUrl(urlInput);
    const newHistory = [urlInput, ...history.filter(u => u !== urlInput)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('videoHistory', JSON.stringify(newHistory));
  };

  const handleHistoryClick = (url) => {
    setUrlInput(url);
    setCurrentUrl(url);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('videoHistory');
  };

  const copyEmbedLink = () => {
    if (!currentUrl) return;
    const embedCode = `<iframe src="${window.location.origin}/embed?url=${encodeURIComponent(currentUrl)}" width="100%" height="100%" frameborder="0" allowfullscreen></iframe>`;
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatUrl = (url) => {
    try {
      const u = new URL(url);
      return u.hostname + u.pathname.slice(0, 40) + (u.pathname.length > 40 ? '...' : '');
    } catch {
      return url.slice(0, 50) + (url.length > 50 ? '...' : '');
    }
  };

  const supportedFormats = [
    { ext: '.mp4', label: 'MP4' },
    { ext: '.m3u8', label: 'HLS' },
    { ext: '.mpd', label: 'DASH' },
    { ext: 'YT', label: 'YouTube' },
    { ext: 'VM', label: 'Vimeo' },
  ];

  return (
    <div className="min-h-screen bg-surface-base text-text-primary flex flex-col relative overflow-hidden">
      {/* Ambient background — animated maroon orbs + grid */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-accent-maroon/15 to-accent/10 rounded-full blur-[150px] animate-orb" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-gradient-to-tl from-accent-maroon/15 to-accent/10 rounded-full blur-[120px] animate-orb-slow" />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-accent-maroonDark/20 rounded-full blur-[100px] animate-orb" />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Header */}
      <header className="w-full relative z-10 border-b border-border-muted/50 bg-surface-raised/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-maroon via-accent to-accent-hover flex items-center justify-center shadow-lg shadow-accent-maroon/40 animate-glow-pulse">
              <MonitorPlay size={22} className="text-white" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <div>
            <h1 className="text-xl font-extrabold tracking-tight text-text-primary">
              Nexus<span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-maroonLight via-accent to-accent-hover animate-gradient-pan">Stream</span>
            </h1>
              <p className="text-xs text-text-tertiary font-medium tracking-wider uppercase hidden sm:block">Universal Video Player</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Supported formats badges — desktop only */}
            <div className="hidden lg:flex items-center gap-1.5" aria-label="Supported formats">
              {supportedFormats.map(f => (
                <span key={f.ext} className="text-xs font-bold text-text-tertiary bg-surface-muted border border-border-muted px-2 py-1 rounded-sm">
                  {f.label}
                </span>
              ))}
            </div>

            {/* CORS Proxy Toggle */}
            <div className="flex items-center gap-2.5 bg-surface-muted/80 backdrop-blur-sm px-3 py-2 rounded-lg border border-border-muted/60">
              <Server size={16} className={proxyEnabled ? 'text-accent' : 'text-text-inverse'} aria-hidden="true" />
              <span className="text-xs font-medium text-text-secondary hidden sm:inline">CORS Proxy</span>
              <button
                onClick={() => setProxyEnabled(!proxyEnabled)}
                role="switch"
                aria-checked={proxyEnabled}
                aria-label="Toggle CORS proxy"
                className={`w-9 h-5 rounded-2xl relative transition-all duration-fast ${proxyEnabled ? 'bg-accent shadow-lg shadow-accent/30' : 'bg-border-muted'}`}
              >
                <span className={`w-3.5 h-3.5 bg-white rounded-2xl absolute top-[3px] transition-all duration-fast shadow-sm ${proxyEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10 flex-1 flex flex-col gap-6 sm:gap-8 relative z-10">

        {/* Hero Section */}
        {!currentUrl && (
          <div className="text-center py-4 sm:py-8 animate-fade-in">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight mb-3">
              Stream <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-maroonLight via-accent to-accent-hover animate-gradient-pan">Any Video</span>
            </h2>
            <p className="text-text-secondary text-md max-w-xl mx-auto leading-relaxed">
              Paste any video URL and start watching instantly. Supports MP4, HLS, DASH, YouTube, and Vimeo.
            </p>
          </div>
        )}

        {/* Input Form — compact */}
        <form onSubmit={handlePlay} className="w-full max-w-3xl mx-auto relative group" aria-label="Video URL input">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-accent-maroon via-accent to-accent-maroon rounded-lg blur-md opacity-30 group-hover:opacity-60 group-focus-within:opacity-80 transition-opacity duration-normal animate-gradient-pan" aria-hidden="true" />
          <div className="relative flex items-center bg-surface-muted/90 backdrop-blur-xl border border-border-muted/60 rounded-lg overflow-hidden shadow-2xl shadow-accent-maroonDark/30 transition-all duration-normal group-focus-within:border-accent/40">
            <div className="pl-4 text-text-inverse">
              <LinkIcon size={18} aria-hidden="true" />
            </div>
            <input
              type="text"
              className="flex-1 bg-transparent text-text-primary placeholder-text-inverse py-2.5 sm:py-3 px-3 focus:outline-none text-md sm:text-xl font-medium"
              placeholder="Paste any video URL (.mp4, .m3u8, .mpd, YouTube, Vimeo)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              aria-label="Video URL"
            />
            <button
              type="submit"
              className="m-1.5 bg-gradient-to-r from-accent-maroon via-accent to-accent hover:from-accent-maroonLight hover:to-accent-hover text-white px-4 sm:px-6 py-2 rounded-md font-bold flex items-center gap-2 transition-all duration-normal shadow-lg shadow-accent-maroon/40 hover:shadow-accent/50 hover:scale-[1.03] active:scale-[0.97] text-md"
            >
              <Play size={16} fill="currentColor" aria-hidden="true" /> <span className="hidden sm:inline">Play</span>
            </button>
          </div>
        </form>

        {/* Supported formats — mobile */}
        {!currentUrl && (
          <div className="flex lg:hidden items-center justify-center gap-2 flex-wrap animate-fade-in-delay" aria-label="Supported formats">
            {supportedFormats.map(f => (
              <span key={f.ext} className="text-xs font-bold text-text-tertiary bg-surface-muted/60 border border-border-muted/40 px-2.5 py-1 rounded-md">
                {f.label}
              </span>
            ))}
          </div>
        )}

        {/* Player Section */}
        {currentUrl ? (
          <div className="w-full flex flex-col gap-4 animate-slide-up">
            <div className="w-full rounded-xl ring-1 ring-accent-maroon/40 shadow-[0_0_40px_rgba(128,0,32,0.25)] overflow-hidden bg-surface-base transition-shadow duration-normal hover:shadow-[0_0_55px_rgba(128,0,32,0.4)]">
              <VideoPlayer url={currentUrl} proxyEnabled={proxyEnabled} />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ExternalLink size={14} className="text-text-inverse flex-shrink-0" aria-hidden="true" />
                <p className="text-text-secondary text-sm truncate font-mono" title={currentUrl}>
                  {formatUrl(currentUrl)}
                </p>
              </div>
              <button
                onClick={copyEmbedLink}
                className="text-text-secondary hover:text-text-primary flex items-center gap-2 text-sm font-semibold bg-surface-muted/80 hover:bg-gradient-to-r hover:from-accent-maroon hover:to-accent backdrop-blur-sm px-4 py-2.5 rounded-lg transition-all duration-instant border border-border-muted/50 hover:border-accent/40 hover:shadow-lg hover:shadow-accent-maroon/40 flex-shrink-0"
                aria-live="polite"
              >
                {copied ? (
                  <span className="text-accent flex items-center gap-2"><Check size={14} aria-hidden="true" /> Copied!</span>
                ) : (
                  <><Copy size={14} aria-hidden="true" /> Copy Embed</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-video border-2 border-dashed border-accent-maroon/30 rounded-xl flex flex-col items-center justify-center text-text-tertiary p-6 sm:p-8 text-center bg-gradient-to-b from-accent-maroonDark/10 to-surface-muted/10 backdrop-blur-sm hover:border-accent/50 transition-colors duration-normal animate-fade-in-delay">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-surface-muted to-accent-maroonDark/40 border border-accent-maroon/30 flex items-center justify-center mb-5 animate-glow-pulse">
              <MonitorPlay size={36} className="text-accent" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-bold text-text-secondary mb-2">No Video Selected</h2>
            <p className="max-w-md text-md leading-relaxed">
              Paste a URL above to start streaming. We support direct files, HLS, DASH, YouTube, and Vimeo.
            </p>
          </div>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <div className="animate-slide-up">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full flex items-center justify-between mb-4 group"
              aria-expanded={showHistory}
              aria-controls="history-list"
            >
              <h3 className="text-2xl font-bold text-text-primary flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-md bg-gradient-to-br from-accent-maroon to-accent border border-accent/30 flex items-center justify-center shadow-md shadow-accent-maroon/30">
                  <History size={16} className="text-white" aria-hidden="true" />
                </div>
                Recent Streams
                <span className="text-sm font-medium text-text-tertiary bg-surface-muted px-2 py-0.5 rounded-2xl">{history.length}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); clearHistory(); }}
                  className="text-sm text-text-tertiary hover:text-accent flex items-center gap-1.5 transition-colors duration-instant px-3 py-1.5 rounded-md hover:bg-accent/10"
                  aria-label="Clear watch history"
                >
                  <Trash2 size={13} aria-hidden="true" /> Clear
                </button>
                <ChevronDown
                  size={18}
                  className={`text-accent transition-transform duration-normal ${showHistory ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </div>
            </button>

            <div id="history-list" className={`grid gap-2 overflow-hidden transition-all duration-normal ${showHistory ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 sm:max-h-[500px] sm:opacity-100'}`}>
              {history.map((url, i) => (
                <div
                  key={i}
                  className="bg-surface-muted/40 backdrop-blur-sm border border-border-muted/40 hover:border-accent-maroon/50 hover:bg-gradient-to-r hover:from-surface-muted/60 hover:to-accent-maroonDark/20 p-3 sm:p-4 rounded-lg flex items-center justify-between cursor-pointer transition-all duration-instant group"
                  onClick={() => handleHistoryClick(url)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleHistoryClick(url); } }}
                  aria-label={`Play ${formatUrl(url)} from history`}
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <div className="min-w-8 h-8 rounded-md bg-border-muted/60 flex items-center justify-center text-text-secondary group-hover:bg-gradient-to-br group-hover:from-accent-maroon group-hover:to-accent group-hover:text-white group-hover:shadow-md group-hover:shadow-accent/40 transition-all duration-instant flex-shrink-0">
                      <Play size={14} fill="currentColor" aria-hidden="true" />
                    </div>
                    <p className="text-text-secondary group-hover:text-text-primary text-sm truncate font-mono transition-colors duration-instant">{formatUrl(url)}</p>
                  </div>
                  <span className="text-sm text-text-inverse group-hover:text-accent font-semibold uppercase tracking-wider flex-shrink-0 ml-3 transition-colors duration-instant">
                    Play
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 sm:py-8 text-center border-t border-border-muted/50 relative z-10 bg-surface-raised/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-text-tertiary text-sm">
            Built by <a href="https://github.com/nileshthokale" target="_blank" rel="noopener noreferrer" className="text-transparent bg-clip-text bg-gradient-to-r from-accent-maroonLight to-accent hover:from-accent hover:to-accent-hover transition-all duration-instant font-medium">Nilesh Thokale</a>
          </p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <a href="https://github.com/nileshthokale" target="_blank" rel="noopener noreferrer" className="text-text-inverse hover:text-text-primary text-sm transition-colors duration-instant">GitHub</a>
            <span className="text-border-muted" aria-hidden="true">|</span>
            <a href="https://www.linkedin.com/in/nileshthokale/" target="_blank" rel="noopener noreferrer" className="text-text-inverse hover:text-text-primary text-sm transition-colors duration-instant">LinkedIn</a>
            <span className="text-border-muted" aria-hidden="true">|</span>
            <a href="https://gokalifree.in" target="_blank" rel="noopener noreferrer" className="text-text-inverse hover:text-text-primary text-sm transition-colors duration-instant">Website</a>
          </div>
          <p className="text-text-inverse text-sm mt-2">
            NexusStream &mdash; Universal Video Streaming
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
