import React, { useState, useEffect } from 'react';
import VideoPlayer from './components/VideoPlayer';
import { Play, Link as LinkIcon, Copy, History, Trash2, Server, MonitorPlay, Sparkles, ChevronDown, ExternalLink } from 'lucide-react';

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
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-600/3 rounded-full blur-[120px]" />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-red-900/5 rounded-full blur-[100px]" />
      </div>

      {/* Header */}
      <header className="w-full relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/20">
              <MonitorPlay size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                Nexus<span className="text-red-500">Stream</span>
              </h1>
              <p className="text-[10px] text-zinc-500 font-medium tracking-wider uppercase hidden sm:block">Universal Video Player</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Supported formats badges - desktop only */}
            <div className="hidden lg:flex items-center gap-1.5">
              {supportedFormats.map(f => (
                <span key={f.ext} className="text-[10px] font-bold text-zinc-500 bg-zinc-900/80 border border-zinc-800/50 px-2 py-1 rounded-md">
                  {f.label}
                </span>
              ))}
            </div>

            {/* CORS Proxy Toggle */}
            <div className="flex items-center gap-2.5 bg-zinc-900/60 backdrop-blur-sm px-3 py-2 rounded-xl border border-zinc-800/50">
              <Server size={16} className={proxyEnabled ? "text-green-400" : "text-zinc-500"} />
              <span className="text-xs font-medium text-zinc-400 hidden sm:inline">CORS Proxy</span>
              <button
                onClick={() => setProxyEnabled(!proxyEnabled)}
                className={`w-9 h-5 rounded-full relative transition-all duration-300 ${proxyEnabled ? 'bg-green-500 shadow-lg shadow-green-500/30' : 'bg-zinc-700'}`}
              >
                <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all duration-300 shadow-sm ${proxyEnabled ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
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
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-3">
              Stream <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-600">Any Video</span>
            </h2>
            <p className="text-zinc-400 text-sm sm:text-base max-w-xl mx-auto leading-relaxed">
              Paste any video URL and start watching instantly. Supports MP4, HLS, DASH, YouTube, and Vimeo.
            </p>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handlePlay} className="w-full max-w-3xl mx-auto relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-red-600/20 via-red-600/10 to-red-600/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-500" />
          <div className="relative flex items-center bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/50 transition-all duration-300 group-focus-within:border-red-600/40">
            <div className="pl-4 sm:pl-5 text-zinc-500">
              <LinkIcon size={20} />
            </div>
            <input
              type="text"
              className="flex-1 bg-transparent text-white placeholder-zinc-500 py-4 sm:py-5 px-3 sm:px-4 focus:outline-none text-sm sm:text-base font-medium"
              placeholder="Paste any video URL (.mp4, .m3u8, .mpd, YouTube, Vimeo)..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
            <button
              type="submit"
              className="m-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white px-5 sm:px-7 py-2.5 sm:py-3 rounded-xl font-bold flex items-center gap-2 transition-all duration-300 shadow-lg shadow-red-600/20 hover:shadow-red-600/40 hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
            >
              <Play size={18} fill="currentColor" /> <span className="hidden sm:inline">Play</span>
            </button>
          </div>
        </form>

        {/* Supported formats - mobile */}
        {!currentUrl && (
          <div className="flex lg:hidden items-center justify-center gap-2 flex-wrap animate-fade-in-delay">
            {supportedFormats.map(f => (
              <span key={f.ext} className="text-[10px] font-bold text-zinc-500 bg-zinc-900/60 border border-zinc-800/40 px-2.5 py-1 rounded-lg">
                {f.label}
              </span>
            ))}
          </div>
        )}

        {/* Player Section */}
        {currentUrl ? (
          <div className="w-full flex flex-col gap-4 animate-slide-up">
            <div className="w-full shadow-2xl shadow-black/60 rounded-xl sm:rounded-2xl ring-1 ring-white/5 overflow-hidden bg-black">
              <VideoPlayer url={currentUrl} proxyEnabled={proxyEnabled} />
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <ExternalLink size={14} className="text-zinc-500 flex-shrink-0" />
                <p className="text-zinc-400 text-xs sm:text-sm truncate font-mono" title={currentUrl}>
                  {formatUrl(currentUrl)}
                </p>
              </div>
              <button
                onClick={copyEmbedLink}
                className="text-zinc-300 hover:text-white flex items-center gap-2 text-xs sm:text-sm font-semibold bg-zinc-800/80 hover:bg-zinc-700/80 backdrop-blur-sm px-4 py-2.5 rounded-xl transition-all duration-200 border border-zinc-700/50 hover:border-zinc-600/50 flex-shrink-0"
              >
                {copied ? (
                  <span className="text-green-400">Copied!</span>
                ) : (
                  <><Copy size={14} /> Copy Embed</>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full aspect-video border-2 border-dashed border-zinc-800/60 rounded-2xl flex flex-col items-center justify-center text-zinc-500 p-6 sm:p-8 text-center bg-zinc-900/10 backdrop-blur-sm hover:border-zinc-700/60 transition-colors duration-500 animate-fade-in-delay">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-900/60 border border-zinc-800/40 flex items-center justify-center mb-5">
              <MonitorPlay size={36} className="text-zinc-600" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-zinc-300 mb-2">No Video Selected</h2>
            <p className="max-w-md text-sm sm:text-base leading-relaxed">
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
            >
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-600/20 flex items-center justify-center">
                  <History size={16} className="text-red-500" />
                </div>
                Recent Streams
                <span className="text-xs font-medium text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full">{history.length}</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); clearHistory(); }}
                  className="text-xs text-zinc-500 hover:text-red-400 flex items-center gap-1.5 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-600/10"
                >
                  <Trash2 size={13} /> Clear
                </button>
                <ChevronDown
                  size={18}
                  className={`text-zinc-500 transition-transform duration-300 ${showHistory ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            <div className={`grid gap-2 overflow-hidden transition-all duration-500 ${showHistory ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0 sm:max-h-[500px] sm:opacity-100'}`}>
              {history.map((url, i) => (
                <div
                  key={i}
                  className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/40 hover:border-zinc-700/60 hover:bg-zinc-900/60 p-3 sm:p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all duration-200 group"
                  onClick={() => handleHistoryClick(url)}
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <div className="flex items-center gap-3 overflow-hidden min-w-0">
                    <div className="min-w-8 h-8 rounded-lg bg-zinc-800/60 flex items-center justify-center text-zinc-400 group-hover:bg-red-600 group-hover:text-white transition-all duration-300 flex-shrink-0">
                      <Play size={14} fill="currentColor" />
                    </div>
                    <p className="text-zinc-300 text-xs sm:text-sm truncate font-mono">{formatUrl(url)}</p>
                  </div>
                  <span className="text-[10px] sm:text-xs text-zinc-600 font-semibold uppercase tracking-wider flex-shrink-0 ml-3 group-hover:text-red-400 transition-colors">
                    Play
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-6 sm:py-8 text-center border-t border-white/5 relative z-10 bg-black/20 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-zinc-600 text-xs sm:text-sm">
            Built with React, Tailwind CSS & Vite
          </p>
          <p className="text-zinc-700 text-[10px] sm:text-xs mt-1">
            NexusStream &mdash; Universal Video Streaming
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
