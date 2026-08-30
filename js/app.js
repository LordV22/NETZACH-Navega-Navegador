/**
 * NETZACH Navega — Aplicação Principal (App Shell)
 * Navegador PWA offline-first com cookies criptografados.
 * Integra: motor criptográfico (worker), cofre (IndexedDB), i18n.
 */

import { t, initLang, applyLangToDom, setLang, getLang, LANGS } from './i18n.js';
import { putCookie, getCookie, getAllCookies, deleteCookie, clearCookies, setMeta, getMeta } from './vault.js';

const $ = id => document.getElementById(id);

const els = {
    startup: $('startup'),
    startupMsg: $('startupMsg'),
    browser: $('browser'),
    step: $('step'),
    frame: $('frame'),
    urlInput: $('urlInput'),
    secDot: $('secDot'),
    btnBack: $('btnBack'),
    btnFwd: $('btnFwd'),
    btnReload: $('btnReload'),
    btnExternal: $('btnExternal'),
    btnIncognito: $('btnIncognito'),
    btnVault: $('btnVault'),
    btnLanguage: $('btnLanguage'),
    btnClear: $('btnClear'),
    sidebar: $('sidebar'),
    cookieList: $('cookieList'),
    cookieCount: $('cookieCount'),
    logList: $('logList'),
    langPicker: $('langPicker'),
    score: $('score'),
    status: $('status'),
    secStatus: $('secStatus'),
    toast: $('toast'),
    cryptoFp: $('cryptoFp'),
    cryptoSalt: $('cryptoSalt')
};

let cryptoReady = false;
let isIncognito = false;
let lastDomain = null;
let historyStack = [];
let historyIdx = -1;
let toastTimer = null;
let cryptoWorker = null;
let workerReady = false;

function sendToWorker(type, payload) {
    return new Promise((resolve) => {
        if (!cryptoWorker) { resolve({ ok: false, error: 'no-worker' }); return; }
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => resolve(e.data);
        cryptoWorker.postMessage({ type, payload }, [channel.port2]);
        setTimeout(() => resolve({ ok: false, error: 'timeout' }), 3000);
    });
}

function initCryptoWorker() {
    if (!window.Worker) return;
    try {
        cryptoWorker = new Worker('./js/crypto-worker.js');
        cryptoWorker.onmessage = (e) => {
            if (e.data && e.data.type === 'INIT_DONE') {
                workerReady = !!e.data.ok;
                loadCryptoStatus();
            }
        };
        cryptoWorker.onerror = (e) => {
            console.warn('crypto worker error:', e.message);
            cryptoWorker = null;
        };
        cryptoWorker.postMessage({ type: 'INIT' });
    } catch (e) {
        console.warn('Falha ao iniciar worker:', e);
        cryptoWorker = null;
    }
}

async function encryptCookie(value, domain, name) {
    return sendToWorker('ENCRYPT_COOKIE', { value, domain, name });
}

function log(action, detail) {
    const row = document.createElement('div');
    row.className = 'logrow';
    const time = new Date().toLocaleTimeString();
    row.innerHTML = `<span class="t">[${time}]</span> <span class="a">${action}</span> · <span style="color:var(--text)">${detail}</span>`;
    els.logList.insertBefore(row, els.logList.firstChild);
    if (els.logList.children > 60) els.logList.removeChild(els.logList.lastChild);
}

function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2500);
}

function homeHtml() {
    const shortcuts = [
        ['G', 'Google', 'https://www.google.com'],
        ['🌍', 'Globo', 'https://www.globo.com'],
        ['▶️', 'YouTube', 'https://www.youtube.com'],
        ['B', 'Bing', 'https://www.bing.com'],
        ['W', 'Wikipedia', 'https://pt.wikipedia.org'],
        ['U', 'UOL', 'https://www.uol.com.br'],
        ['T', 'Terra', 'https://www.terra.com.br'],
        ['X', 'X/Twitter', 'https://x.com'],
        ['📷', 'Instagram', 'https://www.instagram.com'],
        ['💬', 'WhatsApp', 'https://web.whatsapp.com']
    ];
    const chips = shortcuts.map(([ico, name, url]) =>
        `<a href="#" onclick="event.preventDefault();parent.__navigate('${url}')" class="chip"><span class="co">${ico}</span><span class="cn">${name}</span></a>`
    ).join('');
    return `<!DOCTYPE html><html lang="${getLang()}"><head><style>
        *{box-sizing:border-box}
        body{margin:0;font-family:system-ui,sans-serif;background:linear-gradient(160deg,#05060f,#0a0e1a);color:#e8ecff;
            min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
        .wrap{max-width:560px;width:100%;text-align:center}
        .card{background:rgba(15,18,40,.55);padding:28px 22px;border-radius:20px;border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(8px)}
        h1{background:linear-gradient(135deg,#22d3ee,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent;margin:8px 0;font-size:26px}
        p{color:#8a93b8;line-height:1.6;margin:6px 0;font-size:13px}
        .chips{margin:20px 0 6px;display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:10px}
        .chip{display:flex;flex-direction:column;align-items:center;gap:6px;text-decoration:none;color:#e8ecff;
            background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);padding:12px 6px;border-radius:14px;
            transition:.15s}
        .chip:hover{background:rgba(34,211,238,.16);border-color:rgba(34,211,238,.5);transform:translateY(-2px)}
        .co{font-size:22px;line-height:1}
        .cn{font-size:12px}
        .tags{margin:14px 0 4px}
        .tag{display:inline-block;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);padding:3px 9px;border-radius:12px;font-size:10px;color:#c4b5fd;margin:3px}
        .hint{margin-top:14px;color:#22d3ee;font-size:12px}
    </style></head><body><div class="wrap">
        <div class="card">
            <h1>🛡️ NETZACH Navega</h1>
            <p>${t('home_online')}</p>
            <div class="tags"><span class="tag">🔐 AES-256-GCM</span><span class="tag">🌀 5 camadas</span><span class="tag">🔑 PBKDF2→HKDF</span><span class="tag">🔒 No-Referrer</span><span class="tag">👁️ Incógnito</span></div>
            <p>Pesquise ou digite o site na barra acima.</p>
            <div class="chips">${chips}</div>
            <div class="hint">Toque num atalho ou digite a busca/site na barra acima · use ↗ para abrir fora do app</div>
        </div>
    </div></body></html>`;
}

function btoaUnicode(str) {
    return btoa(unescape(encodeURIComponent(str)))
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function openExternal(url) {
    const w = window.open(url, '_blank', 'noopener');
    if (!w) {
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
    }
    els.status.textContent = t('openedExternal');
}

function normalizeUrl(raw) {
    let value = raw.trim();
    if (!value) return '';
    let url = value;
    if (!/^https?:\/\//i.test(url)) {
        if (url.includes('.') && !url.includes(' ')) url = 'https://' + url;
        else url = 'https://search.brave.com/search?q=' + encodeURIComponent(url);
    }
    return url;
}

function navigate(raw) {
    const url = normalizeUrl(raw);
    if (!url) return;
    els.urlInput.value = url;
    setSecureState(url);
    els.status.textContent = `${t('loading')}: ${url}`;
    log('NAVIGATE', url);

    try { lastDomain = new URL(url).hostname; } catch (e) { lastDomain = null; }
    if (lastDomain && !isIncognito) interceptSessionCookies(lastDomain);

    historyStack = historyStack.slice(0, historyIdx + 1);
    if (historyStack[historyStack.length - 1] !== url) historyStack.push(url);
    historyIdx = historyStack.length - 1;

    /* Renderiza dentro do app via proxy (funciona para Google/Globo/YouTube
       etc. contornando o bloqueio de iframe). Se falhar, o usuário tem o
       botão "abrir no navegador" como fallback. */
    els.frame.removeAttribute('srcdoc');
    els.frame.src = '/proxy/' + btoaUnicode(url);
}

async function interceptSessionCookies(domain) {
    try {
        const encrypted = await encryptCookie(
            crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
            domain,
            'nz_session'
        );
        if (encrypted && encrypted.ok && encrypted.stored) {
            await putCookie(encrypted.stored);
            log('CRYPT', `sessão de '${domain}'`);
            showToast(`🛡️ ${t('secureCookie')} · ${domain}`);
            refreshVault();
            updateScore();
        }
    } catch (e) {
        console.warn(e);
    }
}

function setSecureState(url) {
    if (url.startsWith('https://')) {
        els.secDot.className = 'dot secure';
        els.secStatus.textContent = t('statusSecure');
        els.secDot.title = t('connSecure');
    } else {
        els.secDot.className = 'dot warn';
        els.secStatus.textContent = '⚠️ ' + t('connInsecure');
        els.secDot.title = t('connInsecure');
    }
}

async function refreshVault() {
    const all = await getAllCookies();
    els.cookieCount.textContent = all.length
        ? all.length + ' ' + t('storedAt')
        : t('countZero');

    els.cookieList.innerHTML = '';
    if (!all.length) {
        const empty = document.createElement('div');
        empty.style.cssText = 'color:var(--muted);font-size:12px;padding:8px 0';
        empty.textContent = t('noCookies');
        els.cookieList.appendChild(empty);
        return;
    }

    all.forEach(c => {
        const item = document.createElement('div');
        item.className = 'cookie';
        const time = new Date(c.t || c.storedAt).toLocaleTimeString();
        item.innerHTML = `
            <div class="nm">${c.name} <span class="dom">· ${c.domain}</span></div>
            <div class="dt"><span>${t('storedAt')} ${time}</span><span>🔄 ${c.mutation || 1}</span></div>
            <div class="blob">blob: ${(c.blob.d || '').slice(0, 34)}…</div>
            <div class="layers"><span class="lt cy">${t('layers')}</span>${(c.blob.l || []).map((l, i) => `<span class="lt${i % 2 ? ' cy' : ''}">${l}</span>`).join('')}</div>
        `;
        els.cookieList.appendChild(item);
    });
}

async function updateScore() {
    const all = await getAllCookies();
    let s = 100;
    s -= all.length * 2;
    if (isIncognito) s += 10;
    s = Math.max(45, Math.min(100, s));
    els.score.textContent = s + '%';
}

/* Expõe as credenciais do motor criptográfico na interface */
async function loadCryptoStatus() {
    if (!cryptoWorker) {
        if (els.cryptoFp) els.cryptoFp.textContent = 'worker indisponível';
        return;
    }
    const res = await sendToWorker('STATUS');
    if (res && res.ok && res.crypto) {
        const c = res.crypto;
        if (els.cryptoFp) els.cryptoFp.textContent = c.fingerprint || '—';
        if (els.cryptoSalt) els.cryptoSalt.textContent = c.salt || '—';
        if (els.secStatus) {
            els.secStatus.textContent = `🛡️ AES-256-GCM + KDF ${c.iterations.toLocaleString()} · camadas ${c.layers.length}`;
            els.secStatus.title = JSON.stringify(c, null, 0).slice(0, 300);
        }
        log('CRYPTO', `${c.algo}/${c.keyLength} · ${c.kdf}@${c.iterations} · ${c.layers.length} camadas · v${c.version}`);
    } else if (els.cryptoFp) {
        els.cryptoFp.textContent = res && res.error ? res.error : 'aguardando...';
    }
}

function toggleVault() {
    els.sidebar.classList.toggle('open');
    refreshVault();
}

function toggleIncognito() {
    isIncognito = !isIncognito;
    els.btnIncognito.classList.toggle('active', isIncognito);
    if (isIncognito) {
        clearCookies().then(() => { refreshVault(); updateScore(); });
        log('INCOGNITO', t('incognitoOn'));
        showToast(t('incognitoOn'));
    } else {
        log('INFO', t('incognitoOff'));
        showToast(t('incognitoOff'));
    }
}

function buildLangPicker() {
    els.langPicker.innerHTML = '';
    Object.entries(LANGS).forEach(([code, obj]) => {
        const b = document.createElement('button');
        b.className = 'langbtn';
        b.textContent = `${obj.flag} ${obj.label}`;
        b.classList.toggle('active', getLang() === code);
        b.onclick = () => {
            setLang(code);
            applyLangToDom();
            buildLangPicker();
            showToast(`${t('langChanged')}: ${obj.label}`);
            if (els.frame && !els.frame.src) els.frame.srcdoc = homeHtml();
            log('LANG', obj.label);
        };
        els.langPicker.appendChild(b);
    });
}

function toggleLanguage() {
    buildLangPicker();
    if (!els.sidebar.classList.contains('open')) els.sidebar.classList.add('open');
}

async function init() {
    initLang();
    applyLangToDom();
    buildLangPicker();

    els.step.textContent = t('encrypting') + ' · AES-256-GCM';
    els.step.style.color = 'var(--violet)';

    // Service Worker (offline) — separado do worker de criptografia
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }
    // Web Worker dedicado para criptografia pesada (roda no aparelho)
    initCryptoWorker();

    // garante a entrada mesmo se o worker falhar
    setTimeout(markReady, 2000);
}

let booted = false;
function markReady() {
    if (booted) return;
    booted = true;
    els.startup.style.display = 'none';
    els.browser.style.display = 'flex';
    els.frame.srcdoc = homeHtml();
    els.status.textContent = t('statusReady');
    log('INIT', t('initialized'));
    log('INFO', t('offline'));
    refreshVault();
    updateScore();
    loadCryptoStatus();
    els.step.textContent = t('initialized');
}

// Eventos
els.urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(els.urlInput.value); });
els.btnReload.addEventListener('click', () => { els.frame.removeAttribute('srcdoc'); els.frame.src = els.frame.src; els.status.textContent = t('loading') + '…'; });
els.btnIncognito.addEventListener('click', toggleIncognito);
els.btnVault.addEventListener('click', toggleVault);
els.btnLanguage.addEventListener('click', toggleLanguage);
els.btnClear.addEventListener('click', async () => {
    const n = (await getAllCookies()).length;
    await clearCookies();
    refreshVault();
    updateScore();
    log('CLEAR', n + ' ' + t('cleared'));
    showToast('🧹 ' + n + ' ' + t('cleared'));
});

function goUrl(url) {
    els.urlInput.value = url;
    setSecureState(url);
    els.status.textContent = t('statusReady');
    els.frame.removeAttribute('srcdoc');
    els.frame.src = '/proxy/' + btoaUnicode(url);
}

els.btnBack.addEventListener('click', () => { if (historyIdx > 0) { historyIdx--; goUrl(historyStack[historyIdx]); } });
els.btnFwd.addEventListener('click', () => { if (historyIdx < historyStack.length - 1) { historyIdx++; goUrl(historyStack[historyIdx]); } });
els.btnExternal.addEventListener('click', () => {
    const u = els.urlInput.value;
    if (u && /^https?:/i.test(u)) openExternal(u);
    else showToast('⚠️ ' + t('noUrl'));
});

els.frame.addEventListener('load', () => {
    els.status.textContent = t('statusReady');
    const real = els.urlInput.value;
    if (real && real !== 'about:blank' && /^https?:/i.test(real)) {
        setSecureState(real);
    }
});

let beforeinstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    beforeinstall = e;
});

init();

window.__navigate = (u) => navigate(u || '');
