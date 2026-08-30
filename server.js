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
 * exibição em iframe (contorna X-Frame-Options / frame-ancestors).
 * Reescreve URLs de recursos para passarem pelo proxy e injeta um shim
 * que roteia fetch/XMLHttpRequest pela origem real (evita CORS), fazendo
 * sites dinâmicos (Globo, Google, Bing) renderizarem de verdade.
 */
const SHIM = `(function(){
 var _BASE=%BASE%;
 var P=function(u){
   try{var x=new URL(u,_BASE);
     if(/^(data|blob|about|javascript|mailto|#):/i.test(x.protocol)){return u;}
     if(x.origin===location.origin){return u;}
     return '/proxy/'+btoa(unescape(encodeURIComponent(x.href))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
   }catch(e){return u;}
 };
 var _f=window.fetch.bind(window);
 window.fetch=function(u,o){return _f(P(u),o);};
 var _o=XMLHttpRequest.prototype.open;
 XMLHttpRequest.prototype.open=function(m,u,async,user,pw){return _o.call(this,m,P(u),async!==false,user,pw);};
})();`;

function fetchUrl(url, redirects = 0) {
    return new Promise((resolve, reject) => {
        if (redirects > 5) return reject(new Error('Muitos redirecionamentos'));
        let parsed;
        try { parsed = new URL(url); } catch (e) { return reject(new Error('URL inválida')); }
        if (!/^https?:$/.test(parsed.protocol)) return reject(new Error('Apenas http/https permitidos'));

        const lib = parsed.protocol === 'https:' ? https : http;
        const req = lib.get(parsed, { headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 NETZACH/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
        } }, (res) => {
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
                finalUrl: url,
                charset: res.headers['content-type'] || ''
            }));
        });
        req.on('error', reject);
        req.setTimeout(20000, () => { req.destroy(new Error('Tempo esgotado')); });
    });
}

function btoaUnicode(str) {
    return Buffer.from(str, 'utf8').toString('base64url');
}
function atobUnicode(b64) {
    return Buffer.from(b64, 'base64url').toString('utf8');
}
function shimWith(base) {
    return SHIM.replace('%BASE%', JSON.stringify(base));
}

function rewriteHtml(html, baseUrl) {
    const P = (u) => '/proxy/' + btoaUnicode(new URL(u, baseUrl).toString());
    return html
        /* src/href/action - absolutos e relativos -> proxy */
        .replace(/\b(src|href|action|poster)=(["'])([^"']*)\2/g, (m, a, q, u) => {
            if (/^(data|blob|about|javascript|mailto|#):/i.test(u)) return m;
            if (/^(https?|ftp):/i.test(u)) return `${a}=${q}/proxy/${btoaUnicode(u)}${q}`;
            return `${a}=${q}${P(u)}${q}`;
        })
        /* srcset (imagens responsivas) */
        .replace(/\bsrcset=(["'])([^"']*)\1/g, (m, q, set) => {
            const parts = set.split(',').map(s => s.trim()).filter(Boolean).map(s => {
                const sp = s.split(/\s+/);
                const url = sp[0];
                if (/^data:|^blob:/i.test(url)) return s;
                return P(url) + ' ' + (sp[1] || '');
            });
            return `srcset=${q}${parts.join(', ')}${q}`;
        })
        /* injetar shim de rede no <head> para rotear fetch/XHR pela origem real */
        .replace(/<head([^>]*)>/i, (m, a) => `<head${a}><meta name="referrer" content="no-referrer"><script>${shimWith(baseUrl)}<\/script>`);
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
                'X-Frame-Options': 'ALLOWALL'
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
