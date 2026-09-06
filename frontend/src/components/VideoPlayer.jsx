import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Hls from 'hls.js';
import dashjs from 'dashjs';
import ReactPlayer from 'react-player';
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  Settings, PictureInPicture, Activity, Rewind, FastForward,
  Repeat, Camera, Keyboard, Subtitles, X
} from 'lucide-react';
import { proxyUrl, transcodeUrl, needsTranscode, isLocalFile } from '../config';
import { subtitleBlobUrl, isSubtitleFile } from '../utils/subtitles';

// Format seconds into mm:ss
const formatTime = (seconds) => {
  if (isNaN(seconds)) return '00:00';
  const match = new Date(seconds * 1000).toISOString().match(/(\d{2}:\d{2}:\d{2})/);
  if (!match) return '00:00';
  const time = match[1];
  return time.startsWith('00:') ? time.substring(3) : time;
};

const SHORTCUTS = [
  { keys: 'Space / K', action: 'Play / Pause' },
  { keys: '→ / ←', action: 'Seek ±15 seconds' },
  { keys: '↑ / ↓', action: 'Volume up / down' },
  { keys: 'M', action: 'Mute / unmute' },
  { keys: 'F', action: 'Toggle fullscreen' },
  { keys: 'P', action: 'Picture in picture' },
  { keys: 'A / B', action: 'Set A-B loop points' },
  { keys: 'C', action: 'Capture screenshot' },
  { keys: '?', action: 'Show this help' },
];

const VideoPlayer = ({ url, proxyEnabled, localFile, subtitleFile, onSubtitleFile }) => {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const reactPlayerRef = useRef(null);
  const controlsTimeoutRef = useRef(null);
  const skipTimeoutRef = useRef(null);
  const skipTextOverlayRef = useRef(null);
  const hlsRef = useRef(null);
  const dashRef = useRef(null);
  const audioCheckDoneRef = useRef(false);
  const fileInputRef = useRef(null);

  // Synchronous URL type detection using useMemo to avoid unnecessary re-renders
  const isYouTube = useMemo(() => url?.includes('youtube.com') || url?.includes('youtu.be'), [url]);
  const isVimeo = useMemo(() => url?.includes('vimeo.com'), [url]);
  const isHls = useMemo(() => url?.endsWith('.m3u8') || url?.includes('.m3u8'), [url]);
  const isDash = useMemo(() => url?.endsWith('.mpd') || url?.includes('.mpd'), [url]);
  const isReactPlayerFallback = isYouTube || isVimeo;

  // Local files and YouTube/Vimeo bypass proxy; server-side remux for unsupported containers
  const useProxy = proxyEnabled && !isReactPlayerFallback && !isLocalFile(url);
  const shouldTranscode = useProxy && needsTranscode(url);

  // Core State
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qualities, setQualities] = useState([]);
  const [currentQuality, setCurrentQuality] = useState(-1);
  const [noAudio, setNoAudio] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [transcoding, setTranscoding] = useState(false);

  // A-B loop state
  const [loopA, setLoopA] = useState(null);
  const [loopB, setLoopB] = useState(null);

  // Subtitles state
  const [subtitleUrl, setSubtitleUrl] = useState(null);
  const [subtitleLabel, setSubtitleLabel] = useState('');
  const [subtitlesOn, setSubtitlesOn] = useState(true);

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

  // Memoize the final source URL
  const sourceUrl = useMemo(() => {
    if (!url) return '';
    if (isLocalFile(url)) return url;                 // local blob: direct
    if (shouldTranscode) return transcodeUrl(url);    // MKV/AC3 → backend HLS
    if (useProxy) return proxyUrl(url);               // proxied
    return url;                                       // direct
  }, [url, useProxy, shouldTranscode]);

  // Load subtitle file when provided from App
  useEffect(() => {
    let revokable = null;
    if (subtitleFile) {
      subtitleBlobUrl(subtitleFile).then((blobUrl) => {
        revokable = blobUrl;
        setSubtitleUrl(blobUrl);
        setSubtitleLabel(subtitleFile.name);
        setSubtitlesOn(true);
      });
    } else {
      setSubtitleUrl(null);
      setSubtitleLabel('');
    }
    return () => { if (revokable) URL.revokeObjectURL(revokable); };
  }, [subtitleFile]);

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
  // Native Video Initialization (DASH, HLS, MP4, local, transcode)
  // --------------------------------------------------
  useEffect(() => {
    if (!url || isReactPlayerFallback) return;

    setError(null);
    setLoading(true);
    setTranscoding(shouldTranscode);
    setQualities([]);
    setCurrentQuality(-1);
    setNoAudio(false);
    audioCheckDoneRef.current = false;
    setLoopA(null);
    setLoopB(null);

    const video = videoRef.current;
    if (!video) return;

    const diagnoseFailure = async () => {
      setLoading(false);
      setTranscoding(false);
      if (useProxy) {
        try {
          const resp = await fetch(sourceUrl, { method: 'HEAD' });
          if (resp.status === 404) {
            setError('Video not found (404). The file has been moved or removed from the server.');
            return;
          }
          if (resp.status === 403 || resp.status === 401) {
            setError(`Access denied (${resp.status}). The link is expired, signed, or hotlink-protected.`);
            return;
          }
          if (resp.status === 503) {
            setError('Server-side transcoding is unavailable (ffmpeg missing on server). Enable it to play MKV/AVI files.');
            return;
          }
          if (!resp.ok) {
            setError(`Server responded with ${resp.status}.`);
            return;
          }
          setError('The server responded OK, but the file is not a video format your browser can play.');
          return;
        } catch {
          // fall through to generic message
        }
      }
      setError('Error loading video format or CORS restrictions blocked access. Try enabling the CORS Proxy toggle in the header.');
    };

    const loadVideo = async () => {
      try {
        video.muted = isMuted;
        video.volume = volume;

        if (isHls || shouldTranscode) {
          // HLS implementation (native HLS or backend-transcoded stream)
          if (Hls.isSupported()) {
            const hls = new Hls({ debug: false });
            hlsRef.current = hls;
            hls.loadSource(sourceUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
              setLoading(false);
              setTranscoding(false);
              const availableQualities = data.levels.map((level, index) => ({
                height: level.height,
                bitrate: level.bitrate,
                index: index,
              }));
              setQualities(availableQualities);
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
              if (data.fatal) {
                setError('HLS Error: ' + data.type);
                setLoading(false);
                setTranscoding(false);
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = sourceUrl;
            video.addEventListener('loadedmetadata', () => {
              setLoading(false);
              setTranscoding(false);
            });
          } else {
            setError('HLS is not supported by your browser.');
            setLoading(false);
            setTranscoding(false);
          }

        } else if (isDash) {
          const dashLib = dashjs || window.dashjs;
          if (!dashLib || !dashLib.MediaPlayer) {
            throw new Error('dash.js library could not be properly initialized.');
          }

          const dash = dashLib.MediaPlayer().create();
          dashRef.current = dash;
          dash.initialize(video, sourceUrl, true);
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
          });

        } else {
          // Standard MP4 / local file
          video.onloadeddata = () => { setLoading(false); };
          video.onerror = () => {
            diagnoseFailure();
          };
          video.src = sourceUrl;
          video.load();
        }
      } catch (err) {
        setError('Player error: ' + err.message);
        setLoading(false);
        setTranscoding(false);
      }
    };

    loadVideo();

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
      if (videoRef.current) {
        videoRef.current.onloadeddata = null;
        videoRef.current.onerror = null;
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      setLoading(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl]);

  // --------------------------------------------------
  // A-B loop + subtitle track toggling
  // --------------------------------------------------
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setCurrentTime(video.currentTime);
    setProgress((video.currentTime / video.duration) * 100);

    if (video.buffered.length > 0) {
      const bufferedEnd = video.buffered.end(video.buffered.length - 1);
      setBuffer((bufferedEnd / video.duration) * 100);
    }

    // A-B loop enforcement
    if (loopA !== null && loopB !== null && video.currentTime >= loopB) {
      video.currentTime = loopA;
    }

    // One-shot audio detection (after 3s of playback to avoid false positives)
    if (!audioCheckDoneRef.current) {
      const hasAudio =
        video.mozHasAudio === true ||
        (typeof video.webkitAudioDecodedByteCount === 'number' && video.webkitAudioDecodedByteCount > 0) ||
        (video.audioTracks && video.audioTracks.length > 0);
      if (hasAudio) {
        audioCheckDoneRef.current = true;
      } else if (video.currentTime > 3 && video.readyState >= 2) {
        audioCheckDoneRef.current = true;
        setNoAudio(true);
      }
    }
  };

  const setLoopPoint = (point) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    if (point === 'A') {
      setLoopA(video.currentTime);
      // If B exists and is before A, reset B
      if (loopB !== null && loopB <= video.currentTime) setLoopB(null);
    } else {
      if (loopA === null) return; // A must be set first
      if (video.currentTime <= loopA) return; // B must be after A
      setLoopB(video.currentTime);
    }
  };

  const clearLoop = () => {
    setLoopA(null);
    setLoopB(null);
  };

  const captureScreenshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    try {
      const link = document.createElement('a');
      link.download = `nexustranshot-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.warn('Screenshot failed', e);
    }
  };

  // Toggle subtitle track rendering via textTracks API
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const track = video.textTracks?.[0];
    if (track) {
      track.mode = subtitlesOn ? 'showing' : 'hidden';
    }
  }, [subtitlesOn, subtitleUrl]);

  const handleSubtitleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!isSubtitleFile(file.name)) {
      alert('Please select a .srt or .vtt subtitle file');
      return;
    }
    const blobUrl = await subtitleBlobUrl(file);
    setSubtitleUrl(blobUrl);
    setSubtitleLabel(file.name);
    setSubtitlesOn(true);
    e.target.value = '';
  };

  // --------------------------------------------------
  // Handlers
  // --------------------------------------------------
  const handleSkip = useCallback((seconds) => {
    const text = seconds > 0 ? `+${seconds}s` : `${seconds}s`;

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
        if (videoRef.current.readyState < 2) return;
        const duration = videoRef.current.duration;
        if (!duration) return;
        let newTime = videoRef.current.currentTime + seconds;
        if (newTime < 0) newTime = 0;
        if (newTime > duration) newTime = duration;
        videoRef.current.currentTime = newTime;
      }
    }
  }, [isReactPlayerFallback]);

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
      videoRef.current.muted = newVol === 0;
    }
    setIsMuted(newVol === 0);
  };

  const toggleMute = () => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    if (videoRef.current) {
      videoRef.current.muted = newMuted;
      if (!newMuted && volume === 0) {
        setVolume(1);
        videoRef.current.volume = 1;
      }
    }
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
  // Keyboard shortcuts
  // --------------------------------------------------
  useEffect(() => {
    const handleKeydown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
        return;
      }

      if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
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
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        if (videoRef.current) {
          const v = Math.min(1, videoRef.current.volume + 0.1);
          setVolume(v);
          videoRef.current.volume = v;
          videoRef.current.muted = false;
          setIsMuted(false);
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (videoRef.current) {
          const v = Math.max(0, videoRef.current.volume - 0.1);
          setVolume(v);
          videoRef.current.volume = v;
          setIsMuted(v === 0);
        }
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'p') {
        togglePiP();
      } else if (e.key.toLowerCase() === 'a') {
        setLoopPoint('A');
      } else if (e.key.toLowerCase() === 'b') {
        setLoopPoint('B');
      } else if (e.key.toLowerCase() === 'c') {
        captureScreenshot();
      }
    };
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });

  // --------------------------------------------------
  // Rendering
  // --------------------------------------------------

  const aLoopActive = loopA !== null && loopB !== null;

  return (
    <div
      ref={containerRef}
      className={`relative w-full aspect-video bg-surface-base rounded-lg sm:rounded-xl shadow-2xl overflow-hidden group flex items-center justify-center font-sans tracking-wide border border-border-muted/50 transition-all ${isFullscreen ? 'rounded-none border-none' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => !isReactPlayerFallback && isPlaying && setShowControls(false)}
      onDoubleClick={!isReactPlayerFallback ? toggleFullscreen : undefined}
      onClick={(e) => {
        if (isReactPlayerFallback) return;
        if(e.target.tagName.toLowerCase() === 'video' || e.target.id === 'click-overlay') togglePlay();
      }}
    >
      {/* Hidden file input for subtitles */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".srt,.vtt"
        onChange={handleSubtitleFileChange}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Universal Loading State */}
      {loading && !error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-base/60 backdrop-blur-sm pointer-events-none" role="status" aria-live="polite">
           <div className="w-16 h-16 border-[5px] border-accent border-t-transparent rounded-full animate-spin shadow-[0_0_15px_rgba(220,38,38,0.5)]"></div>
           {transcoding && <span className="mt-4 text-text-secondary text-md">Transcoding to browser-friendly format…</span>}
           <span className="sr-only">Loading video</span>
        </div>
      )}

      {/* Universal Error State */}
      {error && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-surface-muted overflow-hidden" role="alert" aria-live="assertive">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-accent to-transparent" aria-hidden="true"></div>
          <Activity size={48} className="text-accent mb-4 animate-pulse relative z-10" aria-hidden="true" />
          <div className="text-text-secondary font-semibold text-3xl relative z-10 px-8 text-center max-w-lg">{error}</div>
        </div>
      )}

      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-surface-base/90 backdrop-blur-md" role="dialog" aria-label="Keyboard shortcuts" onClick={() => setShowShortcuts(false)}>
          <div className="bg-surface-muted border border-border-muted/60 rounded-xl p-6 max-w-md w-[90%] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                <Keyboard size={20} className="text-accent" aria-hidden="true" /> Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcuts(false)} className="text-text-tertiary hover:text-text-primary transition-colors duration-instant" aria-label="Close shortcuts">
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-2">
              {SHORTCUTS.map(s => (
                <div key={s.keys} className="flex items-center justify-between text-md">
                  <span className="text-text-secondary">{s.action}</span>
                  <kbd className="text-text-primary bg-surface-raised border border-border-muted/60 px-2 py-1 rounded-sm font-mono text-sm">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skip Feedback Overlay */}
      <div className="absolute inset-0 z-40 flex items-center justify-center pointer-events-none" aria-hidden="true">
        <div
          ref={skipTextOverlayRef}
          className="bg-surface-base/60 text-text-primary text-3xl md:text-5xl font-bold px-6 py-4 rounded-2xl backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.5)] transition-all duration-normal opacity-0 transform scale-100"
        >
          {/* Handled by refs seamlessly */}
        </div>
      </div>

      {/* No-audio notice */}
      {noAudio && !error && !isReactPlayerFallback && (
        <div className="absolute top-3 left-3 z-30 flex items-center gap-2 bg-surface-base/70 backdrop-blur-md text-text-secondary text-md font-medium px-3 py-2 rounded-lg border border-border-muted/50 pointer-events-none max-w-[85%]" role="status">
          <VolumeX size={14} className="text-accent flex-shrink-0" aria-hidden="true" />
          <span>No audio detected &mdash; this video may have no audio track or use an audio codec your browser can&rsquo;t decode (e.g., AC3/DTS)</span>
        </div>
      )}

      {/* A-B loop badge */}
      {aLoopActive && !error && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 bg-surface-base/70 backdrop-blur-md text-text-secondary text-md font-medium px-3 py-2 rounded-lg border border-accent/40 pointer-events-none" role="status">
          <Repeat size={14} className="text-accent" aria-hidden="true" />
          <span className="font-mono">A {formatTime(loopA)} → B {formatTime(loopB)}</span>
          <button onClick={clearLoop} className="text-text-tertiary hover:text-accent transition-colors duration-instant pointer-events-auto" aria-label="Clear A-B loop">
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Conditionally Render Single Player */}
      {isReactPlayerFallback ? (
        <div className="absolute inset-0 w-full h-full">
          <ReactPlayer
            ref={reactPlayerRef}
            url={url}
            width="100%"
            height="100%"
            controls={true}
            playing={true}
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
          {/* Native HTML5 Tag */}
          <video
            ref={videoRef}
            className={`w-full h-full object-contain focus:outline-none ${showControls && !isPlaying ? 'scale-[0.99] brightness-90' : 'scale-100 brightness-100'} transition-all duration-normal will-change-transform`}
            crossOrigin={useProxy ? 'anonymous' : undefined}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            aria-label="Video player"
          >
            {subtitleUrl && (
              <track kind="subtitles" src={subtitleUrl} srcLang="en" label={subtitleLabel || 'Subtitles'} default={subtitlesOn} />
            )}
          </video>

          {/* Click Overlay */}
          <div id="click-overlay" className="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" />

          {/* Controls Overlay */}
          <div
            className={`absolute inset-x-0 bottom-0 z-30 pt-24 pb-4 px-6 bg-gradient-to-t from-surface-base/95 via-surface-base/60 to-transparent transition-all duration-normal ease-out transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}`}
          >
            {/* Progress Bar */}
            <div className="relative w-full h-2 mb-4 group/progress cursor-pointer flex items-center rounded-full overflow-visible">
              <div className="absolute left-0 w-full h-1.5 bg-white/20 rounded-full transition-all group-hover/progress:h-2.5 shadow-inner" />
              <div className="absolute left-0 h-1.5 bg-white/40 rounded-full transition-all group-hover/progress:h-2.5 backdrop-blur-sm" style={{ width: `${buffer}%` }} />
              <div className="absolute left-0 h-1.5 bg-accent rounded-full z-10 transition-all group-hover/progress:h-2.5 shadow-[0_0_10px_rgba(220,38,38,0.7)]" style={{ width: `${progress}%` }} />
              {/* A-B loop markers on the progress bar */}
              {loopA !== null && duration > 0 && (
                <div className="absolute h-2.5 w-0.5 bg-accent-hover z-20 top-1/2 -translate-y-1/2" style={{ left: `${(loopA / duration) * 100}%` }} aria-hidden="true" />
              )}
              {loopB !== null && duration > 0 && (
                <div className="absolute h-2.5 w-0.5 bg-accent-hover z-20 top-1/2 -translate-y-1/2" style={{ left: `${(loopB / duration) * 100}%` }} aria-hidden="true" />
              )}
              {(loopA !== null && loopB !== null && duration > 0) && (
                <div className="absolute h-1 top-1/2 -translate-y-1/2 bg-accent/30 z-0" style={{ left: `${(loopA / duration) * 100}%`, width: `${((loopB - loopA) / duration) * 100}%` }} aria-hidden="true" />
              )}
              <div
                className="absolute h-4 w-4 bg-white border-2 border-accent rounded-full z-20 transform -translate-y-1/2 top-1/2 scale-0 group-hover/progress:scale-100 transition-transform shadow-lg"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
              <input
                type="range" min="0" max="100" value={progress || 0}
                onChange={handleSeekChange}
                aria-label="Seek video position"
                className="absolute inset-0 w-full h-full opacity-0 z-30 cursor-pointer"
              />
            </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between text-text-primary/90">
              <div className="flex items-center gap-4 sm:gap-6">
                <button onClick={(e) => { e.stopPropagation(); handleSkip(-15); }} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md" title="Backward 15s" aria-label="Backward 15 seconds">
                  <Rewind size={24} fill="currentColor" aria-hidden="true" />
                </button>

                <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md" aria-label={isPlaying ? 'Pause video' : 'Play video'}>
                  {isPlaying ? <Pause size={28} fill="currentColor" aria-hidden="true" /> : <Play size={28} fill="currentColor" aria-hidden="true" />}
                </button>

                <button onClick={(e) => { e.stopPropagation(); handleSkip(15); }} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md" title="Forward 15s" aria-label="Forward 15 seconds">
                  <FastForward size={24} fill="currentColor" aria-hidden="true" />
                </button>

                {/* A-B loop controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); loopA === null ? setLoopPoint('A') : (loopB === null ? setLoopPoint('B') : clearLoop()); }}
                    className={`transition-all focus:outline-none drop-shadow-md text-sm font-bold px-2 py-1 rounded-sm border ${aLoopActive ? 'border-accent text-accent bg-accent/10' : loopA !== null ? 'border-accent/50 text-accent' : 'border-border-muted/60 text-text-tertiary hover:text-text-primary'}`}
                    title="Set A point, then B point, click again to clear"
                    aria-label="A-B loop"
                  >
                    A→B
                  </button>
                </div>

                <div className="flex items-center gap-3 group/volume relative">
                  <button onClick={toggleMute} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md" aria-label={isMuted ? 'Unmute volume' : 'Mute volume'}>
                    {isMuted || volume === 0 ? <VolumeX size={24} aria-hidden="true" /> : <Volume2 size={24} aria-hidden="true" />}
                  </button>
                  <div className="w-0 overflow-hidden group-hover/volume:w-24 transition-all duration-normal ease-out flex items-center">
                    <input
                      type="range" min="0" max="1" step="0.05" value={volume}
                      onChange={handleVolumeChange}
                      aria-label="Volume"
                      className="w-20 h-1.5 bg-white/30 rounded-full appearance-none cursor-pointer accent-accent"
                    />
                  </div>
                </div>

                <div className="text-sm font-semibold tracking-wider font-mono opacity-80 select-none drop-shadow-md bg-surface-base/30 px-3 py-1 rounded-md backdrop-blur-md border border-border-muted/50 hidden sm:block" aria-live="off">
                  {formatTime(currentTime)} <span className="text-accent/80 mx-1" aria-hidden="true">/</span> {formatTime(duration)}
                </div>
              </div>

              {/* Right Controls */}
              <div className="flex items-center gap-4 sm:gap-5 relative">
                {showSettings && (
                  <div className="absolute bottom-14 right-0 bg-surface-base/80 backdrop-blur-xl border border-border-muted/50 rounded-xl p-3 min-w-[220px] mb-2 shadow-2xl z-50" role="menu" aria-label="Playback settings">
                    <div className="mb-3">
                      <div className="text-sm text-accent uppercase font-bold tracking-widest px-2 mb-2 flex items-center gap-2">
                        <Activity size={12} aria-hidden="true"/> Video Quality
                      </div>
                      {qualities.length > 0 ? (
                        <div className="space-y-1">
                          <button
                            onClick={() => handleQualityChange(-1)}
                            className={`w-full text-left px-3 py-2 rounded-md text-md font-medium transition-colors duration-instant ${currentQuality === -1 ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-text-primary'}`}
                            role="menuitem"
                          >
                            Auto (Recommended)
                          </button>
                          {qualities.sort((a,b) => b.height - a.height).map(q => (
                            <button
                              key={q.index}
                              onClick={() => handleQualityChange(q.index)}
                              className={`w-full text-left px-3 py-2 rounded-md text-md font-medium transition-colors duration-instant ${currentQuality === q.index ? 'bg-accent/20 text-accent' : 'hover:bg-white/10 text-text-primary'}`}
                              role="menuitem"
                            >
                              {q.height ? `${q.height}p HD` : `${(q.bitrate/1000).toFixed(0)} kbps`}
                            </button>
                          ))}
                        </div>
                      ) : <div className="px-3 py-2 text-md text-text-tertiary italic bg-white/5 rounded-md">Auto-configured by source</div>}
                    </div>

                    <div className="border-t border-border-muted/50 my-2" />

                    <div>
                      <div className="text-sm text-accent uppercase font-bold tracking-widest px-2 mb-2">Playback Speed</div>
                      <div className="flex gap-1">
                        {[0.5, 1, 1.5, 2, 10].map(speed => (
                           <button
                             key={speed}
                             onClick={() => changePlaybackRate(speed)}
                             className={`flex-1 py-1.5 text-sm font-semibold rounded-md transition-all duration-instant ${playbackRate === speed ? 'bg-accent text-white shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'hover:bg-white/10 text-text-primary'}`}
                             role="menuitemradio"
                             aria-checked={playbackRate === speed}
                           >
                             {speed}x
                           </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Subtitles button */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="text-text-primary hover:text-accent transition-all focus:outline-none drop-shadow-md"
                    title="Load subtitle file (.srt / .vtt)"
                    aria-label="Load subtitle file"
                  >
                    <Subtitles size={22} aria-hidden="true" />
                  </button>
                  {subtitleUrl && (
                    <button
                      onClick={() => setSubtitlesOn(!subtitlesOn)}
                      className={`text-xs font-bold px-2 py-1 rounded-sm border transition-all focus:outline-none ${subtitlesOn ? 'border-accent text-accent bg-accent/10' : 'border-border-muted/60 text-text-tertiary'}`}
                      title="Toggle subtitles on/off"
                      aria-label="Toggle subtitles"
                      aria-pressed={subtitlesOn}
                    >
                      CC
                    </button>
                  )}
                </div>

                {/* Screenshot button */}
                <button onClick={captureScreenshot} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md" title="Screenshot (C)" aria-label="Capture screenshot">
                  <Camera size={22} aria-hidden="true" />
                </button>

                <button onClick={() => setShowSettings(!showSettings)} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md" aria-label="Playback settings" aria-expanded={showSettings}>
                  <Settings size={24} aria-hidden="true" />
                </button>
                <button onClick={togglePiP} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md hidden sm:block" aria-label="Picture in picture">
                  <PictureInPicture size={24} aria-hidden="true" />
                </button>
                <button onClick={toggleFullscreen} className="text-text-primary hover:text-accent hover:scale-110 transition-all focus:outline-none drop-shadow-md" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
                  {isFullscreen ? <Minimize size={24} aria-hidden="true" /> : <Maximize size={24} aria-hidden="true" />}
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
