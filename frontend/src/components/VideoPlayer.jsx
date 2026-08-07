import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import dashjs from 'dashjs';
import ReactPlayer from 'react-player';
import { 
  Play, Pause, Volume2, VolumeX, Maximize, Minimize, 
  Settings, PictureInPicture, Activity, Rewind, FastForward
} from 'lucide-react';

// Format seconds into mm:ss
const formatTime = (seconds) => {
  if (isNaN(seconds)) return '00:00';
  const match = new Date(seconds * 1000).toISOString().match(/(\d{2}:\d{2}:\d{2})/);
  if (!match) return '00:00';
  const time = match[1];
  return time.startsWith('00:') ? time.substring(3) : time;
};

const VideoPlayer = ({ url, proxyEnabled }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const reactPlayerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const skipTimeoutRef = useRef(null);
  const skipTextOverlayRef = useRef(null);
  const hlsRef = useRef(null);
  const dashRef = useRef(null);

  // Synchronous URL type detection using useMemo to avoid unnecessary re-renders
  const isYouTube = useMemo(() => url?.includes('youtube.com') || url?.includes('youtu.be'), [url]);
  const isVimeo = useMemo(() => url?.includes('vimeo.com'), [url]);
  const isHls = useMemo(() => url?.endsWith('.m3u8') || url?.includes('.m3u8'), [url]);
  const isDash = useMemo(() => url?.endsWith('.mpd') || url?.includes('.mpd'), [url]);
  const isReactPlayerFallback = isYouTube || isVimeo;

  // Core State
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);

  // Player UI State (Only applicable for HTML5/HLS/DASH)
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [buffer, setBuffer] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Memoize proxiedUrl to maintain stable reference
  const proxiedUrl = useMemo(() => {
    if (!url) return '';
    return proxyEnabled && !isReactPlayerFallback ? `http://localhost:5000/proxy?url=${encodeURIComponent(url)}` : url;
  }, [url, proxyEnabled, isReactPlayerFallback]);

  // --------------------------------------------------
  // Fallback Loading State Effect
  // --------------------------------------------------
  useEffect(() => {
    if (isReactPlayerFallback) {
      setLoading(true);
      setError(null);
    }
  }, [isReactPlayerFallback, url]);

  const playerConfig = useMemo(() => ({
    youtube: { 
      playerVars: { 
        modestbranding: 1, 
        rel: 0,
        origin: typeof window !== 'undefined' ? window.location.origin : ''
      } 
    }
  }), []);

  // --------------------------------------------------
  // Native Video Initialization (DASH, HLS, MP4)
  // --------------------------------------------------
  useEffect(() => {
    if (!url || isReactPlayerFallback) return;

    setError(null);
    setLoading(true);
    setQualities([]);
    setCurrentQuality(-1);
    
    // NOTE: Removed state resets like setCurrentTime(0) and setIsPlaying(false)
    // to preserve playback flow and prevent unnecessary visual stutter.

    const video = videoRef.current;
    if (!video) return;

    const loadVideo = async () => {
      try {
        if (isHls) {
          // HLS implementation
          if (Hls.isSupported()) {
            const hls = new Hls({ debug: false });
            hlsRef.current = hls;
            hls.loadSource(proxiedUrl);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              setLoading(false);
              const availableQualities = data.levels.map((level, index) => ({
                height: level.height,
                bitrate: level.bitrate,
                index: index,
              }));
              setQualities(availableQualities);
              // Video play is now manually controlled by the user
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) { 
                setError('HLS Error: ' + data.type); 
                setLoading(false); 
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedUrl;
            video.addEventListener('loadedmetadata', () => { 
              setLoading(false); 
              // Playback initiates manually
            });
          } else {
            setError('HLS is not supported by your browser.');
            setLoading(false);
          }

        } else if (isDash) {
          // DASH implementation
          // Using standard module dashjs import as default, with fallback just in case
          const dashLib = dashjs || window.dashjs;
          if (!dashLib || !dashLib.MediaPlayer) {
            throw new Error('dash.js library could not be properly initialized.');
          }

          const dash = dashLib.MediaPlayer().create();
          dashRef.current = dash;
          dash.initialize(video, proxiedUrl, true);
          dash.on(dashLib.MediaPlayer.events.ERROR, (e) => { 
            setError('DASH Error: ' + (e.error?.message || e.error || 'Unknown Error')); 
            setLoading(false); 
          });
          dash.on(dashLib.MediaPlayer.events.STREAM_INITIALIZED, () => {
            setLoading(false);
            try {
              const bitrateList = dash.getBitrateInfoListFor('video');
              if (bitrateList) {
                setQualities(bitrateList.map((info) => ({ 
                  height: info.height, 
                  bitrate: info.bitrate, 
                  index: info.qualityIndex 
                })));
              }
            } catch(e) {}
            // Playback initiates manually
          });
          
        } else {
          // Standard MP4 Fallback
          video.src = proxiedUrl;
          video.onloadeddata = () => { setLoading(false); };
          video.onerror = () => { 
            setError('Error loading video format or CORS restrictions blocked access.'); 
            setLoading(false); 
          };
        }
      } catch (err) { 
        setError('Player error: ' + err.message); 
        setLoading(false); 
      }
    };

    loadVideo();

    // Ensure proper cleanup of hls.js and dash.js instances
    return () => {
      if (hlsRef.current) { 
        hlsRef.current.destroy(); 
        hlsRef.current = null; 
      }
      if (dashRef.current) { 
        dashRef.current.reset(); 
        if (dashRef.current.destroy) dashRef.current.destroy(); 
        dashRef.current = null; 
      }
      setLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const handleSkip = useCallback((seconds) => {
    const text = seconds > 0 ? `+${seconds}s` : `${seconds}s`;
    
    // Direct DOM manipulation guarantees NO component re-renders!
    if (skipTextOverlayRef.current) {
      skipTextOverlayRef.current.innerText = text;
      skipTextOverlayRef.current.style.opacity = '1';
      skipTextOverlayRef.current.style.transform = 'scale(1.2)';
      
      if (skipTimeoutRef.current) clearTimeout(skipTimeoutRef.current);
      skipTimeoutRef.current = setTimeout(() => {
        if (skipTextOverlayRef.current) {
          skipTextOverlayRef.current.style.opacity = '0';
          skipTextOverlayRef.current.style.transform = 'scale(1)';
        }
      }, 500);
    }

    if (isReactPlayerFallback) {
      if (reactPlayerRef.current) {
        const currentTime = reactPlayerRef.current.getCurrentTime() || 0;
        const duration = reactPlayerRef.current.getDuration() || 0;
        if (duration === 0) return;
        let newTime = currentTime + seconds;
        if (newTime < 0) newTime = 0;
        if (newTime > duration) newTime = duration;
        reactPlayerRef.current.seekTo(newTime, 'seconds');
      }
    } else {
      if (videoRef.current) {
        // Only allow skipping when video is ready (readyState >= 2: HAVE_CURRENT_DATA)
        if (videoRef.current.readyState < 2) return;
        
        const duration = videoRef.current.duration;
        if (!duration) return;
        
        // Compute precise new time enforcing boundaries
        let newTime = videoRef.current.currentTime + seconds;
        if (newTime < 0) newTime = 0;
        if (newTime > duration) newTime = duration;
        
        // Directly maneuver the video player time
        videoRef.current.currentTime = newTime;
      }
    }
  }, [isReactPlayerFallback]);

  useEffect(() => {
    const handleKeydown = (e) => {
      // Ignore if typing in an input
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.code === 'Space') {
        if (!isReactPlayerFallback) {
          e.preventDefault();
          togglePlay();
        }
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSkip(15);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSkip(-15);
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [isPlaying, isReactPlayerFallback, handleSkip]);

  // --------------------------------------------------
  // Handlers (Exclusive to Native Video)
  // --------------------------------------------------
  const togglePlay = (forcePlay = null) => {
    if (!videoRef.current) return;
    if (forcePlay === true || (forcePlay === null && videoRef.current.paused)) {
      videoRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setCurrentTime(video.currentTime);
    setProgress((video.currentTime / video.duration) * 100);
    
    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffer((bufferedEnd / video.duration) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) setDuration(videoRef.current.duration);
  };

  const handleSeekChange = (e) => {
    const newVal = parseFloat(e.target.value);
    const seekToTime = (newVal / 100) * duration;
    
    if (videoRef.current) {
      videoRef.current.currentTime = seekToTime;
    }
    setProgress(newVal);
  };

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (videoRef.current) {
      videoRef.current.volume = newVol;
    }
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
    }
    setVolume(newMuted ? 0 : 1);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => console.log(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {
      console.warn("PiP not supported or blocked", e);
    }
  };

  const handleMouseMove = () => {
    if (isReactPlayerFallback) return;
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) setShowControls(false);
      setShowSettings(false);
    }, 3000);
  };

  const handleQualityChange = (qualityIndex) => {
    setCurrentQuality(qualityIndex);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = qualityIndex;
    } else if (dashRef.current) {
      if (qualityIndex === -1) {
        dashRef.current.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } });
      } else {
        dashRef.current.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
        dashRef.current.setQualityFor('video', qualityIndex);
      }
    }
    setShowSettings(false);
  };

  const changePlaybackRate = (rate) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSettings(false);
  };

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------

  return (
    <div 
      ref={containerRef}
      className={`relative w-full aspect-video bg-black rounded-lg sm:rounded-2xl shadow-2xl overflow-hidden group flex items-center justify-center font-sans tracking-wide border border-zinc-900 transition-all ${isFullscreen ? 'rounded-none border-none' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !isReactPlayerFallback && isPlaying && setShowControls(false)}
      onDoubleClick={!isReactPlayerFallback ? toggleFullscreen : undefined}
      onClick={(e) => {
        if (isReactPlayerFallback) return;
        if(e.target.tagName.toLowerCase() === 'video' || e.target.id === 'click-overlay') togglePlay();
      }}
    >
      {/* Universal Loading States */}
      {loading && !error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-none">
           <div className="w-16 h-16 border-[5px] border-red-600 border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
        </div>
      )}
      
      {/* Universal Error States */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900 overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-600 to-transparent"></div>
          <Activity size={48} className="text-red-500 mb-4 animate-pulse relative z-10" />
          <div className="text-red-400 font-semibold text-lg relative z-10 px-8 text-center max-w-lg">{error}</div>
        </div>
      )}

      {/* Skip Feedback Overlay without React State to prevent tearing players down */}
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none">
        <div 
          ref={skipTextOverlayRef}
          className="bg-black/60 text-white text-3xl md:text-5xl font-bold px-6 py-4 rounded-full backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all duration-300 opacity-0 transform scale-100"
        >
          {/* Handled by refs seamlessly */}
        </div>
      </div>

      {/* Conditionally Render Single Player */}
      {isReactPlayerFallback ? (
        <div className="absolute inset-0 w-full h-full">
          <ReactPlayer
            ref={reactPlayerRef}
            url={url}
            width="100%"
            height="100%"
            controls={true}
            playing={true}  // Play automatically and handle anti-buffering
            onReady={() => setLoading(false)}
            onStart={() => setLoading(false)}
            onBuffer={() => setLoading(true)}
            onBufferEnd={() => setLoading(false)}
            onError={() => {
              setError('Unable to load video stream from the provided link. Link might be restricted.');
              setLoading(false);
            }}
            config={playerConfig}
          />
        </div>
      ) : (
        <>
          {/* Native HTML5 Tag strictly for MP4/HLS/DASH */}
          <video
            ref={videoRef}
            className={`w-full h-full object-contain focus:outline-none ${showControls && !isPlaying ? 'scale-[0.99] brightness-90' : 'scale-100 brightness-100'} transition-all duration-500 will-change-transform`}
            crossOrigin="anonymous"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />

          {/* Click Overlay strictly for MP4/HLS/DASH */}
          <div id="click-overlay" className="absolute inset-0 z-10 cursor-pointer" />

          {/* Modern Glassmorphic Controls Overlay (Native Only) */}
          <div 
            className={`absolute inset-x-0 bottom-0 z-30 pt-24 pb-4 px-6 bg-gradient-to-t from-black/95 via-black/60 to-transparent transition-all duration-500 ease-out transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}
          >
            {/* Progress Bar Container */}
            <div className="relative w-full h-2 mb-4 group/progress cursor-pointer flex items-center rounded-full overflow-visible" >
              <div className="absolute left-0 w-full h-1.5 bg-white/20 rounded-full transition-all group-hover/progress:h-2.5 shadow-inner" />
              <div className="absolute left-0 h-1.5 bg-white/40 rounded-full transition-all group-hover/progress:h-2.5 backdrop-blur-sm" style={{ width: `${buffer}%` }} />
              <div className="absolute left-0 h-1.5 bg-red-600 rounded-full z-10 transition-all group-hover/progress:h-2.5 shadow-[0_0_10px_rgba(220,38,38,0.7)]" style={{ width: `${progress}%` }} />
              <div 
                className="absolute h-4 w-4 bg-white border-2 border-red-600 rounded-full z-20 transform -translate-y-1/2 top-1/2 scale-0 group-hover/progress:scale-100 transition-transform shadow-lg" 
                style={{ left: `calc(${progress}% - 8px)` }} 
              />
              <input 
                type="range" min="0" max="100" value={progress || 0}
                onChange={handleSeekChange}
                className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-pointer"
              />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between text-white/90">
              <div className="flex items-center gap-4 sm:gap-6">
                <button onClick={(e) => { e.stopPropagation(); handleSkip(-15); }} className="text-white hover:text-red-500 hover:scale-110 transition-all focus:outline-none drop-shadow-md" title="Backward 15s">
                  <Rewind size={24} fill="currentColor" />
                </button>
                
                <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-red-500 hover:scale-110 transition-all focus:outline-none drop-shadow-md">
                  {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} ml={1} fill="currentColor" />}
                </button>

                <button onClick={(e) => { e.stopPropagation(); handleSkip(15); }} className="text-white hover:text-red-500 hover:scale-110 transition-all focus:outline-none drop-shadow-md" title="Forward 15s">
                  <FastForward size={24} fill="currentColor" />
                </button>
                
                <div className="flex items-center gap-3 group/volume relative">
                  <button onClick={toggleMute} className="hover:text-red-500 hover:scale-110 transition-all focus:outline-none drop-shadow-md">
                    {isMuted || volume === 0 ? <VolumeX size={24} /> : <Volume2 size={24} />}
                  </button>
                  <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-300 ease-out flex items-center">
                    <input 
                      type="range" min="0" max="1" step="0.05" value={volume}
                      onChange={handleVolumeChange}
                      className="w-20 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-red-600 hover:accent-red-500"
                    />
                  </div>
                </div>

                <div className="text-sm font-semibold tracking-wider font-mono opacity-80 select-none drop-shadow-md bg-black/30 px-3 py-1 rounded-md backdrop-blur-md border border-white/10 hidden sm:block">
                  {formatTime(currentTime)} <span className="text-red-500/80 mx-1">/</span> {formatTime(duration)}
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-5 relative">
                {showSettings && (
                  <div className="absolute bottom-14 right-0 bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-3 min-w-[220px] mb-2 shadow-2xl z-50">
                    <div className="mb-3">
                      <div className="text-[10px] text-red-500 uppercase font-bold tracking-widest px-2 mb-2 flex items-center gap-2">
                        <Activity size={12}/> Video Quality
                      </div>
                      {qualities.length > 0 ? (
                        <div className="space-y-1">
                          <button 
                            onClick={() => handleQualityChange(-1)} 
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentQuality === -1 ? 'bg-red-600/20 text-red-500' : 'hover:bg-white/10 text-white/90'}`}
                          >
                            Auto (Recommended)
                          </button>
                          {qualities.sort((a,b) => b.height - a.height).map(q => (
                            <button 
                              key={q.index}
                              onClick={() => handleQualityChange(q.index)}
                              className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${currentQuality === q.index ? 'bg-red-600/20 text-red-500' : 'hover:bg-white/10 text-white/90'}`}
                            >
                              {q.height ? `${q.height}p HD` : `${(q.bitrate/1000).toFixed(0)} kbps`}
                            </button>
                          ))}
                        </div>
                      ) : <div className="px-3 py-2 text-sm text-zinc-400 italic bg-white/5 rounded-lg">Auto-configured by source</div>}
                    </div>
                    
                    <div className="border-t border-white/10 my-2" />
                    
                    <div>
                      <div className="text-[10px] text-red-500 uppercase font-bold tracking-widest px-2 mb-2">Playback Speed</div>
                      <div className="flex gap-1">
                        {[0.5, 1, 1.5, 2, 10].map(speed => (
                           <button
                             key={speed}
                             onClick={() => changePlaybackRate(speed)}
                             className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${playbackRate === speed ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'hover:bg-white/10 text-white/90'}`}
                           >
                             {speed}x
                           </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <button onClick={() => setShowSettings(!showSettings)} className="hover:text-red-500 hover:scale-110 transition-all focus:outline-none drop-shadow-md">
                  <Settings size={24} className={showSettings ? 'animate-spin-slow text-red-500' : ''} />
                </button>
                <button onClick={togglePiP} className="hover:text-red-500 hover:scale-110 transition-all focus:outline-none drop-shadow-md hidden sm:block">
                  <PictureInPicture size={24} />
                </button>
                <button onClick={toggleFullscreen} className="hover:text-red-500 hover:scale-110 transition-all focus:outline-none drop-shadow-md">
                  {isFullscreen ? <Minimize size={24} /> : <Maximize size={24} />}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoPlayer;

