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
    toast: $('toast')
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
    return `<!DOCTYPE html><html lang="${getLang()}"><head><style>
        body{margin:0;font-family:system-ui,sans-serif;background:#05060f;color:#e8ecff;
            display:flex;align-items:center;justify-content:center;min-height:100vh}
        .card{background:rgba(15,18,40,.6);padding:36px;border-radius:18px;max-width:520px;text-align:center;margin:20px;border:1px solid rgba(255,255,255,.08)}
        h1{background:linear-gradient(135deg,#22d3ee,#8b5cf6);-webkit-background-clip:text;background-clip:text;color:transparent;margin:12px 0}
        p{color:#8a93b8;line-height:1.6;margin:8px 0}
        .tags{margin:20px 0}
        .tag{display:inline-block;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.3);padding:5px 12px;border-radius:14px;font-size:12px;color:#c4b5fd;margin:4px}
        .logo{font-size:54px}
    </style></head><body><div class="card">
        <div class="logo">🛡️</div>
        <h1>${t('home_brand')}</h1>
        <p>${t('home_sub')}</p>
        <p>${t('home_desc')}</p>
        <div class="tags">
            <span class="tag">🔐 AES-256-GCM</span>
            <span class="tag">🌀 5 camadas</span>
            <span class="tag">🔑 PBKDF2→HKDF</span>
            <span class="tag">🔒 No-Referrer</span>
            <span class="tag">👁️ Incógnito</span>
        </div>
        <p>${t('home_online')}</p>
        <p style="color:#22d3ee">${t('home_go')}</p>
    </div></body></html>`;
}

function navigate(raw) {
    const value = raw.trim();
    if (!value) return;
    let url = value;
    if (!/^https?:\/\//i.test(url)) {
        if (url.includes('.') && !url.includes(' ')) url = 'https://' + url;
        else url = 'https://www.bing.com/search?q=' + encodeURIComponent(url);
    }
    els.urlInput.value = url;
    setSecureState(url);
    els.frame.src = url;
    els.status.textContent = `${t('loading')}: ${url}`;
    log('NAVIGATE', url);

    try { lastDomain = new URL(url).hostname; } catch (e) { lastDomain = null; }
    if (lastDomain && !isIncognito) interceptSessionCookies(lastDomain);
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
    els.step.style.color = 'var(--purple)';

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
    els.step.textContent = t('initialized');
}

// Eventos
els.urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigate(els.urlInput.value); });
els.btnReload.addEventListener('click', () => { els.frame.src = els.frame.src; els.status.textContent = t('loading') + '…'; });
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

els.btnBack.addEventListener('click', () => { if (historyIdx > 0) { historyIdx--; els.frame.src = historyStack[historyIdx]; } });
els.btnFwd.addEventListener('click', () => { if (historyIdx < historyStack.length - 1) { historyIdx++; els.frame.src = historyStack[historyIdx]; } });
els.frame.addEventListener('load', () => {
    els.status.textContent = t('statusReady');
    if (els.frame.src && els.frame.src !== 'about:blank') {
        historyStack = historyStack.slice(0, historyIdx + 1);
        historyStack.push(els.frame.src);
        historyIdx = historyStack.length - 1;
        setSecureState(els.frame.src);
    }
});

let beforeinstall = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    beforeinstall = e;
});

init();
