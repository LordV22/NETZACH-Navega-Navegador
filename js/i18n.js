/**
 * NETZACH Navega — i18n (pt-PT / en / es)
 * Afeta TODA a interface do navegador, incluindo os menus,
 * botões, status e o motor do app.
 */

export const LANGS = {
    'pt': { label: 'Português', flag: '🇧🇷' },
    'en': { label: 'English', flag: '🇺🇸' },
    'es': { label: 'Español', flag: '🇪🇸' }
};

const MESSAGES = {
    // pt (padrão)
    pt: {
        initializing: 'Criptografando motor de sessão...',
        title: 'NETZACH Navega',
        brandBadge: 'SEGURO',
        placeholder: 'Digite uma URL ou busca...',
        back: 'Voltar',
        forward: 'Avançar',
        reload: 'Recarregar',
        incognito: 'Modo Incógnito',
        vault: 'Cofre de Cookies',
        statusReady: 'Pronto',
        openedExternal: 'Abrindo no navegador...',
        statusSecure: '🛡️ AES-256-GCM Ativo',
        connSecure: 'Conexão Segura',
        connInsecure: 'Conexão Não Criptografada',
        connBlocked: 'Cookies de terceiros bloqueados',
        loading: 'Carregando',
        incognitoOn: 'Modo Incógnito ativo — cookies não persistem',
        incognitoOff: 'Modo Incógnito desativado',
        vaultTitle: '🍪 Cofre de Cookies',
        countZero: '0 armazenados',
        logTitle: '📜 Log de Segurança',
        clearAll: '🧹 Limpar todos os cookies',
        cleared: 'cookies criptografados removidos',
        encrypting: 'Criptografando',
        initialized: 'Motor criptográfico inicializado',
        secureCookie: 'Cookie de sessão criptografado',
        noCookies: 'Nenhum cookie armazenado ainda',
        storedAt: 'armazenado',
        layers: 'camadas de ofuscação',
        install: 'Instalar app',
        language: 'Idioma',
        langChanged: 'Idioma alterado',
        offline: 'App disponível offline',
        home_brand: '🛡️ NETZACH Navega',
        home_sub: 'Navegador PWA focado em privacidade e segurança',
        home_desc: 'Todos os cookies de sessão são criptografados (AES-256-GCM) e ofuscados em camadas antes de qualquer persistência no aparelho.',
        home_online: 'Basta sua conexão de internet — o app inteiro roda offline no seu dispositivo.',
        home_go: 'Use a barra acima para navegar',
        action_encrypt: 'ENCRYPT'
    },
    en: {
        initializing: 'Encrypting session engine...',
        title: 'NETZACH Browse',
        brandBadge: 'SECURE',
        placeholder: 'Type a URL or search...',
        back: 'Back',
        forward: 'Forward',
        reload: 'Reload',
        incognito: 'Incognito Mode',
        vault: 'Cookie Vault',
        statusReady: 'Ready',
        openedExternal: 'Opening in browser...',
        statusSecure: '🛡️ AES-256-GCM Active',
        connSecure: 'Secure Connection',
        connInsecure: 'Insecure Connection',
        connBlocked: 'Third-party cookies blocked',
        loading: 'Loading',
        incognitoOn: 'Incognito Mode active — cookies not persisted',
        incognitoOff: 'Incognito Mode off',
        vaultTitle: '🍪 Cookie Vault',
        countZero: '0 stored',
        logTitle: '📜 Security Log',
        clearAll: '🧹 Clear all cookies',
        cleared: 'encrypted cookies removed',
        encrypting: 'Encrypting',
        initialized: 'Crypto engine initialized',
        secureCookie: 'Session cookie encrypted',
        noCookies: 'No cookies stored yet',
        storedAt: 'stored',
        layers: 'obfuscation layers',
        install: 'Install app',
        language: 'Language',
        langChanged: 'Language changed',
        offline: 'App available offline',
        home_brand: '🛡️ NETZACH Browse',
        home_sub: 'Privacy & security focused PWA browser',
        home_desc: 'All session cookies are encrypted (AES-256-GCM) and obfuscated in layers before any persistence on device.',
        home_online: 'Just your internet connection — the whole app runs offline on your device.',
        home_go: 'Use the bar above to browse',
        action_encrypt: 'ENCRYPT'
    },
    es: {
        initializing: 'Cifrando motor de sesión...',
        title: 'NETZACH Navega',
        brandBadge: 'SEGURO',
        placeholder: 'Escribe una URL o búsqueda...',
        back: 'Atrás',
        forward: 'Adelante',
        reload: 'Recargar',
        incognito: 'Modo Incógnito',
        vault: 'Cofre de Cookies',
        statusReady: 'Listo',
        openedExternal: 'Abriendo en el navegador...',
        statusSecure: '🛡️ AES-256-GCM Activo',
        connSecure: 'Conexión Segura',
        connInsecure: 'Conexión No Cifrada',
        connBlocked: 'Cookies de terceros bloqueados',
        loading: 'Cargando',
        incognitoOn: 'Modo Incógnito activo — cookies no persisten',
        incognitoOff: 'Modo Incógnito desactivado',
        vaultTitle: '🍪 Cofre de Cookies',
        countZero: '0 almacenados',
        logTitle: '📜 Registro de Seguridad',
        clearAll: '🧹 Limpiar todas las cookies',
        cleared: 'cookies cifradas eliminadas',
        encrypting: 'Cifrando',
        initialized: 'Motor criptográfico inicializado',
        secureCookie: 'Cookie de sesión cifrada',
        noCookies: 'Aún no hay cookies almacenadas',
        storedAt: 'almacenado',
        layers: 'capas de ofuscación',
        install: 'Instalar app',
        language: 'Idioma',
        langChanged: 'Idioma cambiado',
        offline: 'App disponible sin conexión',
        home_brand: '🛡️ NETZACH Navega',
        home_sub: 'Navegador PWA enfocado en privacidad y seguridad',
        home_desc: 'Todas las cookies de sesión se cifran (AES-256-GCM) y se ofuscan en capas antes de cualquier persistencia en el dispositivo.',
        home_online: 'Solo tu conexión a internet — toda la app funciona sin conexión en tu dispositivo.',
        home_go: 'Usa la barra de arriba para navegar',
        action_encrypt: 'CIFRAR'
    }
};

const FALLBACK = 'pt';
let currentLang = FALLBACK;

export function detectLang() {
    const stored = localStorage.getItem('netzach.lang');
    if (stored && MESSAGES[stored]) return stored;
    const nav = (navigator.language || 'pt').slice(0, 2).toLowerCase();
    return MESSAGES[nav] ? nav : FALLBACK;
}

export function setLang(lang) {
    if (!MESSAGES[lang]) return;
    currentLang = lang;
    localStorage.setItem('netzach.lang', lang);
    document.documentElement.lang = lang;
    document.title = t('title');
}

export function getLang() {
    return currentLang;
}

export function t(key, vars) {
    let str = (MESSAGES[currentLang] && MESSAGES[currentLang][key]) ||
              MESSAGES[FALLBACK][key] || key;
    if (vars) {
        Object.entries(vars).forEach(([k, v]) => {
            str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
        });
    }
    return str;
}

export function applyLangToDom() {
    document.title = t('title');
    const map = {
        '[data-i18n]': el => { el.textContent = t(el.dataset.i18n); },
        '[data-i18n-ph]': el => { el.placeholder = t(el.dataset.i18nPh); },
        '[data-i18n-title]': el => { el.title = t(el.dataset.i18nTitle); }
    };
    Object.entries(map).forEach(([sel, fn]) => {
        document.querySelectorAll(sel).forEach(fn);
    });
}

export function initLang() {
    currentLang = detectLang();
    setLang(currentLang);
    return currentLang;
}
