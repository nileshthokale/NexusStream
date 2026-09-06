// Backend base URL: falls back to localhost for dev; override with VITE_PROXY_URL in production
export const PROXY_BASE = import.meta.env.VITE_PROXY_URL || 'http://localhost:5000';

export const proxyUrl = (url) => `${PROXY_BASE}/proxy?url=${encodeURIComponent(url)}`;
export const transcodeUrl = (url) => `${PROXY_BASE}/transcode?url=${encodeURIComponent(url)}`;

// Containers the <video> element cannot play natively (need server-side transcoding)
const TRANSCODE_EXTENSIONS = ['.mkv', '.avi', '.mov', '.wmv', '.flv', '.m2ts', '.ts'];

// Files with known-browser-unsupported audio codecs (AC3/EAC3/DTS/TrueHD) —
// detected from the filename since we cannot sniff codecs client-side
const UNSUPPORTED_AUDIO_PATTERNS = /\.(ddp?5\.1|dd5\.1|eac3|ac3|dts|truehd|dts-hd)/i;

export const needsTranscode = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase().split('?')[0];
    return TRANSCODE_EXTENSIONS.some((ext) => lower.endsWith(ext)) || UNSUPPORTED_AUDIO_PATTERNS.test(lower);
};

export const isLocalFile = (url) => url?.startsWith('blob:') || url?.startsWith('file:');
