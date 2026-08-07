const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Proxy route: /proxy?url=https://example.com/video.mp4
app.get('/proxy', async (req, res, next) => {
    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Missing url query parameter');
    }

    try {
        // Stream the response to handle large videos
        const response = await axios({
            method: 'get',
            url: targetUrl,
            responseType: 'stream',
            headers: {
                // Forward some headers if needed, like Range for seeking
                ...(req.headers.range && { Range: req.headers.range })
            }
        });

        // Forward headers from target response
        Object.entries(response.headers).forEach(([key, value]) => {
            // Avoid setting conflicting headers
            if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        });

        res.status(response.status);
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        if (error.response) {
            res.status(error.response.status).send(error.response.statusText);
        } else {
            res.status(500).send('Internal Server Proxy Error');
        }
    }
});

app.listen(PORT, () => {
    console.log(`CORS Proxy Server running on port ${PORT}`);
});
