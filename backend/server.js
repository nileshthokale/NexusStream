const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// ---------------------------------------------------------------------------
// ffmpeg detection (env FFMPEG_PATH overrides; otherwise must be on PATH)
// ---------------------------------------------------------------------------
function findFfmpeg() {
    const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'].filter(Boolean);
    for (const cmd of candidates) {
        try {
            const r = spawnSync(cmd, ['-version'], { timeout: 5000, windowsHide: true });
            if (r.status === 0) return cmd;
        } catch { /* keep trying */ }
    }
    return null;
}
const FFMPEG = findFfmpeg();

// ---------------------------------------------------------------------------
// Transcode sessions: MKV/AVI/AC3 → HLS (video copy, audio → AAC)
// ---------------------------------------------------------------------------
const TRANSCODE_DIR = path.join(os.tmpdir(), 'nexustranscode');
const SESSION_TTL_MS = 30 * 60 * 1000; // purge sessions idle for 30 minutes
const sessions = new Map(); // sid -> { proc, dir, lastAccess, failed }

fs.mkdirSync(TRANSCODE_DIR, { recursive: true });

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');

function startTranscodeSession(sid, targetUrl) {
    const dir = path.join(TRANSCODE_DIR, sid);
    fs.mkdirSync(dir, { recursive: true });
    const playlist = path.join(dir, 'index.m3u8');

    // Video stream copied (fast), audio re-encoded to AAC so browsers can play it
    const proc = spawn(FFMPEG, [
        '-hide_banner', '-loglevel', 'error',
        '-user_agent', BROWSER_UA,
        '-referer', new URL(targetUrl).origin + '/',
        '-i', targetUrl,
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k', '-ac', '2',
        '-hls_time', '6',
        '-hls_list_size', '0',
        '-hls_flags', 'independent_segments',
        '-y', playlist,
    ], { windowsHide: true });

    const session = { proc, dir, lastAccess: Date.now(), failed: false, stderr: '' };
    proc.stderr.on('data', (d) => { session.stderr = (session.stderr + d.toString()).slice(-500); });
    proc.on('error', () => { session.failed = true; });
    proc.on('exit', (code) => {
        if (code !== 0 && !fs.existsSync(playlist)) session.failed = true;
    });
    sessions.set(sid, session);
    return session;
}

// Start (or reuse) a session and wait until the first playlist is ready
async function getReadySession(targetUrl) {
    const sid = sha1(targetUrl).slice(0, 16);
    let session = sessions.get(sid);

    if (!session || (session.failed && !fs.existsSync(path.join(session.dir, 'index.m3u8')))) {
        session = startTranscodeSession(sid, targetUrl);
    }
    session.lastAccess = Date.now();

    const playlist = path.join(session.dir, 'index.m3u8');
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
        if (fs.existsSync(playlist)) return { sid, session };
        if (session.failed) {
            throw new Error(session.stderr || 'ffmpeg failed to read the source');
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error('Transcoding timed out');
}

// GET /transcode?url=... → 302 to /transcode/<sid>/index.m3u8
app.get('/transcode', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send('Missing url query parameter');

    try {
        const parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return res.status(400).send('Only http and https URLs are supported');
        }
    } catch {
        return res.status(400).send('Invalid url parameter');
    }

    if (!FFMPEG) {
        return res.status(503).send('Transcoding unavailable: ffmpeg is not installed on the server. Install ffmpeg (or set FFMPEG_PATH) to enable MKV/AVI playback.');
    }

    try {
        const { sid } = await getReadySession(targetUrl);
        res.redirect(`/transcode/${sid}/index.m3u8`);
    } catch (error) {
        console.error('Transcode error:', error.message);
        res.status(502).send('Transcoding failed: ' + error.message);
    }
});

// GET /transcode/<sid>/<file> → serve playlist + segments
app.get('/transcode/:sid/:file', (req, res) => {
    const { sid, file } = req.params;
    if (!/^[a-f0-9]{16}$/.test(sid) || !/^[A-Za-z0-9._-]+$/.test(file)) {
        return res.status(400).send('Invalid session or file');
    }
    const safeExt = /\.(m3u8|ts)$/.test(file);
    if (!safeExt) return res.status(400).send('Unsupported file type');

    const session = sessions.get(sid);
    if (session) session.lastAccess = Date.now();

    const filePath = path.join(TRANSCODE_DIR, sid, file);
    if (!fs.existsSync(filePath)) return res.status(404).send('Segment not found (session may have expired)');

    if (file.endsWith('.m3u8')) {
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store'); // playlist grows until transcode completes
    }
    res.sendFile(filePath);
});

// Purge idle sessions and orphaned directories
function cleanupSessions() {
    const now = Date.now();
    for (const [sid, session] of sessions) {
        if (now - session.lastAccess > SESSION_TTL_MS) {
            if (session.proc && !session.proc.killed) session.proc.kill();
            sessions.delete(sid);
            fs.rm(path.join(TRANSCODE_DIR, sid), { recursive: true, force: true }, () => {});
        }
    }
    // Remove leftover dirs from previous server runs
    try {
        for (const name of fs.readdirSync(TRANSCODE_DIR)) {
            const dir = path.join(TRANSCODE_DIR, name);
            if (!sessions.has(name) && now - fs.statSync(dir).mtimeMs > SESSION_TTL_MS) {
                fs.rm(dir, { recursive: true, force: true }, () => {});
            }
        }
    } catch { /* dir may vanish mid-scan */ }
}
setInterval(cleanupSessions, 60 * 1000);

// Kill all ffmpeg children on shutdown
function killAllSessions() {
    for (const [, s] of sessions) {
        if (s.proc && !s.proc.killed) s.proc.kill();
    }
}
process.on('exit', killAllSessions);
process.on('SIGINT', () => { killAllSessions(); process.exit(0); });
process.on('SIGTERM', () => { killAllSessions(); process.exit(0); });

// ---------------------------------------------------------------------------
// CORS proxy: /proxy?url=https://example.com/video.mp4
// ---------------------------------------------------------------------------
const SKIP_RESPONSE_HEADERS = new Set([
    'transfer-encoding',
    'connection',
    'keep-alive',
    'content-encoding',
    'content-length',
    'upgrade',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
]);

app.get('/proxy', async (req, res) => {
    const targetUrl = req.query.url;
    const refererOverride = req.query.referer;

    if (!targetUrl) {
        return res.status(400).send('Missing url query parameter');
    }

    let parsed;
    try {
        parsed = new URL(targetUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            return res.status(400).send('Only http and https URLs are supported');
        }
    } catch {
        return res.status(400).send('Invalid url parameter');
    }

    const targetReferer = refererOverride || `${parsed.protocol}//${parsed.hostname}/`;
    const rangeHeader = req.headers.range;
    const clientUA = req.headers['user-agent'];
    const clientLang = req.headers['accept-language'];

    const attempts = [
        {
            'User-Agent': clientUA || BROWSER_UA,
            Accept: '*/*',
            ...(clientLang && { 'Accept-Language': clientLang }),
            ...(rangeHeader && { Range: rangeHeader }),
            Referer: targetReferer,
        },
        {
            'User-Agent': BROWSER_UA,
            Accept: '*/*',
            'Accept-Language': 'en-US,en;q=0.9',
            ...(rangeHeader && { Range: rangeHeader }),
        },
    ];

    const sendUpstream = (resp) => {
        Object.entries(resp.headers).forEach(([key, value]) => {
            const lower = key.toLowerCase();
            if (SKIP_RESPONSE_HEADERS.has(lower) || lower.startsWith('access-control-')) return;
            res.setHeader(key, value);
        });

        res.status(resp.status);
        resp.data.pipe(res);
        res.on('close', () => resp.data.destroy());
    };

    for (let i = 0; i < attempts.length; i++) {
        let resp;
        try {
            resp = await axios({
                method: 'get',
                url: targetUrl,
                responseType: 'stream',
                headers: attempts[i],
                validateStatus: () => true,
                maxRedirects: 5,
            });
        } catch (error) {
            console.error('Proxy error:', error.message);
            if (i === attempts.length - 1) {
                return res.status(502).send('Proxy could not reach the target URL');
            }
            continue;
        }

        const retryable = resp.status === 401 || resp.status === 403;
        if (retryable && i < attempts.length - 1) {
            console.warn(`Proxy got ${resp.status} for ${targetUrl}, retrying with different headers`);
            resp.data.destroy();
            continue;
        }

        if (resp.status >= 400) {
            resp.data.destroy();
            const msg = resp.status === 401 || resp.status === 403
                ? 'Forbidden: the video server refused the request. The link may be expired, signed, geo-blocked, or hotlink-protected.'
                : `Upstream responded with ${resp.status}`;
            return res.status(resp.status).send(msg);
        }

        return sendUpstream(resp);
    }
});

app.listen(PORT, () => {
    console.log(`CORS Proxy Server running on port ${PORT}`);
    console.log(FFMPEG
        ? `Transcoding enabled (ffmpeg: ${FFMPEG})`
        : 'Transcoding DISABLED — ffmpeg not found. Install ffmpeg or set FFMPEG_PATH.');
});
