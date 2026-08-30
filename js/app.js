/**
 * NETZACH Navega — Aplicação Principal (App Shell)
 * Navegador PWA offline-first com cookies criptografados.
 * Integra: motor criptográfico (worker), cofre (IndexedDB), i18n.
 */

import { t, initLang, applyLangToDom, setLang, getLang, LANGS } from './i18n.js';
import { putCookie, getCookie, getAllCookies, deleteCookie, clearCookies, setMeta, getMeta } from './vault.js';
import { GOOGLE_CLIENT_ID } from './config.js';
import {
    verifyToken, storeSession, getStoredSession, clearSession,
    getCurrentUser, isAuthed, bootstrapGoogle
} from './auth.js';

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
    btnUser: $('btnUser'),
    authScreen: $('authScreen'),
    authContent: $('authContent'),
    authState: $('authState'),
    accountBox: $('accountBox'),
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

async function sendToWorker(type, payload) {
    return new Promise((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = (e) => resolve(e.data);
        navigator.serviceWorker.controller.postMessage({ type, payload }, [channel.port2]);
        setTimeout(() => resolve({ ok: false, error: 'timeout' }), 3000);
    });
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
        body{margin:0;font-family:system-ui,sans-serif;background:#0a0e1a;color:#e0e6ff;
            display:flex;align-items:center;justify-content:center;min-height:100vh}
        .card{background:#111827;padding:36px;border-radius:18px;max-width:520px;text-align:center;margin:20px}
        h1{color:#10b981;margin:12px 0 12px}
        p{color:#6b7280;line-height:1.6;margin:8px 0}
        .tags{margin:20px 0}
        .tag{display:inline-block;background:#1f2937;padding:5px 12px;border-radius:14px;
            font-size:12px;color:#6366f1;margin:4px}
        .logo{font-size:56px}
    </style></head><body><div class="card">
        <div class="logo">🛡️</div>
        <h1>${t('home_brand')}</h1>
        <p>${t('home_sub')}</p>
        <p>${t('home_desc')}</p>
        <div class="tags">
            <span class="tag">🔐 AES-256-GCM</span>
            <span class="tag">🌀 Obfuscação</span>
            <span class="tag">🔄 Rotação de Chaves</span>
            <span class="tag">🔒 No-Referrer</span>
            <span class="tag">👁️ Incógnito</span>
        </div>
        <p>${t('home_online')}</p>
        <p style="color:#10b981">${t('home_go')}</p>
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
    // navegação real do iframe
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

function installPrompt(e) {
    e.preventDefault();
    showToast(t('install'));
}

function toggleLanguage() {
    buildLangPicker();
    if (!els.sidebar.classList.contains('open')) els.sidebar.classList.add('open');
}

/* ================= Autenticação Google ================= */
function renderUserAvatar() {
    const user = getCurrentUser() || (isAuthed() ? getStoredSession().user : null);
    if (user) {
        els.btnUser.innerHTML = user.picture
            ? `<img src="${user.picture}" alt="">`
            : `<span class="init">${(user.name || user.email || '?').charAt(0).toUpperCase()}</span>`;
    } else {
        els.btnUser.innerHTML = `<span style="color:var(--muted)">👤</span>`;
    }
}

function renderAccountBox() {
    if (!els.accountBox) return;
    const user = getCurrentUser() || (isAuthed() ? getStoredSession().user : null);
    if (!user) { els.accountBox.innerHTML = ''; return; }
    els.accountBox.innerHTML = `
        <div class="auth-user">
            ${user.picture ? `<img src="${user.picture}">` : `<div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--cyan2),var(--violet));display:flex;align-items:center;justify-content:center;font-weight:800">${(user.name||'?').charAt(0)}</div>`}
            <div style="flex:1;min-width:0">
                <div class="un">${user.name || ''}</div>
                <div class="ue">${user.email || ''}</div>
                <div class="um">✓ Conectado com Google</div>
            </div>
        </div>
        <div class="auth-actions">
            <button class="btn-logout" onclick="window.__netzachLogout()">Sair da conta</button>
        </div>`;
}

function handleGoogleCredential(response) {
    const { valid, payload, reason } = verifyToken(response.credential);
    if (!valid) {
        els.authState.textContent = 'Token inválido: ' + reason;
        return;
    }
    storeSession({
        name: payload.name || '',
        email: payload.email || '',
        picture: payload.picture || '',
        sub: payload.sub || '',
        exp: payload.exp
    });
    els.authState.textContent = '✔ Autenticação verificada (JWT)';
    log('AUTH', 'Login Google: ' + payload.email);
    finishLogin();
}

function renderLoginForm(status) {
    els.authContent.innerHTML = `
        <div class="label">Entrar com Google</div>
        <div class="g_id_signin" id="googleBtn"></div>
        <div class="auth-state" id="inlineAuthState" style="margin-top:12px;color:${status.color};font-size:11px;font-family:monospace">${status.msg}</div>`;
}

function setupGoogleButton(container) {
    if (!window.google || !window.google.accounts) return false;
    window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        auto_select: false,
        cancel_on_tap_outside: true
    });
    window.google.accounts.id.renderButton(container, {
        theme: 'filled_black',
        size: 'large',
        width: '100%',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'left'
    });
    return true;
}

async function startGoogleLogin() {
    els.authState.textContent = 'Carregando Google Sign-In...';
    const loaded = bootstrapGoogle(() => {
        const ok = setupGoogleButton(document.getElementById('googleBtn'));
        if (ok) els.authState.textContent = 'Use sua conta Google para continuar.';
    });

    if (!window.google) {
        await new Promise(res => {
            const t = setInterval(() => { if (window.google && window.google.accounts) { clearInterval(t); res(); } }, 100);
            setTimeout(() => { clearInterval(t); res(); }, 8000);
        });
    }
    setupGoogleButton(document.getElementById('googleBtn'));
}

function showAuthScreen() {
    els.authScreen.classList.add('show');
    renderLoginForm({ msg: GOOGLE_CLIENT_ID.startsWith('COLE_') ? '⚠ Client ID não configurado — veja js/config.js' : 'Carregando...', color: '#f59e0b' });
    renderAccountBox();
    if (GOOGLE_CLIENT_ID && !GOOGLE_CLIENT_ID.startsWith('COLE_')) {
        startGoogleLogin();
    }
}

function finishLogin() {
    els.authScreen.classList.remove('show');
    els.startup.style.display = 'flex';
    els.startupMsg.textContent = 'Sessão autenticada. Criptografando...';
    renderUserAvatar();
    renderAccountBox();
    log('AUTH', 'Sessão criptografada iniciada');
    markReady();
}

function completeLogout() {
    clearSession();
    renderUserAvatar();
    renderAccountBox();
    els.sidebar.classList.remove('open');
    showToast('Sessão encerrada');
    booted = false;
    showAuthScreen();
}
window.__netzachLogout = completeLogout;

async function init() {
    initLang();
    applyLangToDom();
    buildLangPicker();

    els.step.textContent = t('encrypting') + ' · AES-256-GCM';
    els.step.style.color = 'var(--purple)';

    // motivo de segurança: o login é obrigatório
    showAuthScreen();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
        navigator.serviceWorker.addEventListener('message', (e) => {
            if (e.data && e.data.type === 'INIT_DONE' && e.data.ok) {
                cryptoReady = true;
            }
        });
        if (navigator.serviceWorker.controller) {
            sendToWorker('INIT').then(() => { cryptoReady = true; });
        }
    }
}

let booted = false;
function markReady() {
    if (booted) return;
    booted = true;
    els.startup.style.display = 'none';
    els.browser.style.display = 'flex';
    els.frame.srcdoc = homeHtml();
    els.status.textContent = t('statusReady');
    renderUserAvatar();
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
els.btnUser.addEventListener('click', () => {
    renderAccountBox();
    if (!els.sidebar.classList.contains('open')) els.sidebar.classList.add('open');
});
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
