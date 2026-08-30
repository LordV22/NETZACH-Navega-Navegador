const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.webmanifest': 'application/manifest+json'
};

/* ---------- Proxy de navegação ----------
 * Busca a página alvo no servidor e a devolve com headers que permitem
 * exibição em iframe. Isso contorna bloqueios de sites como Google/YouTube
 * (X-Frame-Options / frame-ancestors), permitindo-navegar de verdade.
 */
function fetchUrl(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('Too many redirects'));
        let parsed;
        try { parsed = new URL(url); } catch (e) { return reject(new Error('Invalid URL')); }
        if (!/^https?:$/.test(parsed.protocol)) return reject(new Error('Only http/https allowed'));

        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.get(parsed, { headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 NETZACH/1.0', 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const next = new URL(res.headers.location, parsed).toString();
                res.resume();
                return resolve(fetchUrl(next, redirects + 1));
            }
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error('HTTP ' + res.statusCode));
            }
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve({
                body: Buffer.concat(chunks),
                contentType: res.headers['content-type'] || 'text/html',
                finalUrl: url
            }));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => { req.destroy(new Error('Timeout')); });
    });
}

function rewriteHtml(html, baseUrl) {
    return html
        .replace(/(href|src|action|data-src)=(["'])(\/[^"']*)\2/g, (m, attr, q, url) => {
            return `${attr}=${q}https://proxy.nz/${encodeURIComponent(new URL(url, baseUrl).toString())}${q}`;
        })
        .replace(/(href|src|action)=(["'])(https?:\/\/[^"']*)\2/g, (m, attr, q, url) => {
            return `${attr}=${q}/proxy/${btoaUnicode(url)}${q}`;
        });
}

function btoaUnicode(str) {
    return Buffer.from(str, 'utf8').toString('base64url');
}

function atobUnicode(b64) {
    return Buffer.from(b64, 'base64url').toString('utf8');
}

const server = http.createServer(async (req, res) => {
    let urlPath = decodeURIComponent(req.url.split('?')[0]);

    /* --- Proxy de navegação: /proxy/<base64url da url> --- */
    if (urlPath.startsWith('/proxy/')) {
        try {
            const target = atobUnicode(urlPath.replace('/proxy/', ''));
            const { body, contentType, finalUrl } = await fetchUrl(target);
            let out = body;
            if (/text\/html|application\/xhtml/.test(contentType)) {
                out = Buffer.from(rewriteHtml(body.toString('utf8'), finalUrl), 'utf8');
            }
            res.writeHead(200, {
                'Content-Type': contentType,
                'Cache-Control': 'no-store',
                'X-Frame-Options': 'ALLOWALL',
                'X-Content-Type-Options': 'nosniff'
            });
            res.end(out);
        } catch (e) {
            res.writeHead(502, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`<html><body style="font-family:sans-serif;background:#0a0e1a;color:#e8ecff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><div style="text-align:center"><h2>⚠️ Não foi possível carregar a página</h2><p style="color:#8a93b8">${e.message}</p></div></body></html>`);
        }
        return;
    }

    if (urlPath === '/') urlPath = '/index.html';

    let filePath = path.join(ROOT, urlPath);
    if (!filePath.startsWith(ROOT)) {
        res.writeHead(403); res.end('Forbidden'); return;
    }

    const ext = path.extname(filePath);
    const type = MIME[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found'); return;
        }
        res.writeHead(200, {
            'Content-Type': type,
            'Service-Worker-Allowed': '/',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`🛡️ NETZACH Navega rodando na porta ${PORT}`);
});
