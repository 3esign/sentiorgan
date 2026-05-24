import http from 'http';
import httpProxy from 'http-proxy';

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({});

// Modify the proxy response to add CORS headers
proxy.on('proxyRes', function (proxyRes, req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
});

const server = http.createServer(function(req, res) {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.writeHead(200);
        res.end();
        return;
    }

    // Proxy the request to Ollama
    proxy.web(req, res, { target: 'http://127.0.0.1:11434' }, function(e) {
        console.error('Proxy error:', e);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Something went wrong. And we are reporting a custom error message.');
    });
});

console.log("Steampunk Proxy listening on port 8001. Point your web app to http://localhost:8001/api/generate");
server.listen(8001);
