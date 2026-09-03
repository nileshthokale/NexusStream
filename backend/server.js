const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Response headers that must never be forwarded to the client
const SKIP_RESPONSE_HEADERS = new Set([
    'transfer-encoding',
    'connection',
    'keep-alive',
    'content-encoding', // axios decompresses the body; forwarding it corrupts the stream
    'content-length',   // length may mismatch after decompression; use chunked streaming
    'upgrade',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
]);

// Proxy route: /proxy?url=https://example.com/video.mp4[&referer=https://example.com/page]
// Tries two header strategies to get past hotlink protection and UA filtering:
//   1) Browser-like request with a Referer pointing at the video's own site
//   2) Browser-like request without any Referer
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
            // Never forward the target's CORS headers: they would overwrite the
            // Access-Control-Allow-Origin: * set by the cors() middleware and break the browser
            if (SKIP_RESPONSE_HEADERS.has(lower) || lower.startsWith('access-control-')) return;
            res.setHeader(key, value);
        });

        res.status(resp.status);
        resp.data.pipe(res);

        // Stop downloading from upstream if the browser disconnects (seeking aborts requests)
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
});
