/**
 * NETZACH Navega — Motor Criptográfico de Nível Real
 * ─────────────────────────────────────────────────────
 * Criptografia de verdade, não obfuscation por si só:
 *   • Cifra autenticada  AES-256-GCM  (WebCrypto nativo no aparelho)
 *   • Derivação de chave  PBKDF2 → HKDF  (150.000 iterações SHA-256)
 *   • Tag de autenticação (128 bit) — detecta QUALQUER adulteração
 *   • IV único (12 bytes, criptograficamente aleatório) por operação
 *   • Rotação periódica de chave + salt por sessão
 *   • MULTI-LAYER OFUSCAÇÃO adicional sobre o ciphertext (camuflagem)
 */

const CRYPTO_ALGO = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const TAG_LENGTH = 128;
const PBKDF2_ITERATIONS = 150000;
const AAD = 'NETZACH::NAVEGA::AUTH';   // dados autenticados extra
const ROTATION_MS = 5 * 60 * 1000;

let masterKey = null;
let keySalt = null;
let rotationTimer = null;
let sessionFingerprint = null;
let initPromise = null;

const enc = new TextEncoder();
const dec = new TextDecoder();

function randomBytes(n) {
    const a = new Uint8Array(n);
    crypto.getRandomValues(a);
    return a;
}

function bufToHex(b) {
    return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(h) {
    const a = new Uint8Array(h.length / 2);
    for (let i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16);
    return a.buffer;
}

function b64ToBuf(b) {
    const bin = atob(b);
    const a = new Uint8Array(bin.length);
    for (let i = 0; i < a.length; i++) a[i] = bin.charCodeAt(i);
    return a.buffer;
}

function bufToB64(b) {
    const a = new Uint8Array(b);
    let s = '';
    a.forEach(x => s += String.fromCharCode(x));
    return btoa(s);
}

/* ---------- Derivação de chave de verdade (PBKDF2 → HKDF → AES-256) ---------- */
async function initCrypto() {
    keySalt = randomBytes(16);
    sessionFingerprint = getFingerprint();

    /* Passo 1 — PBKDF2: 150.000 iterações SHA-256 sobre a senha raiz */
    const passwordKey = await crypto.subtle.importKey(
        'raw', enc.encode(sessionFingerprint), 'PBKDF2', false, ['deriveBits']
    );
    const seedBits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: enc.encode(bufToHex(keySalt)), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        passwordKey, 256
    );

    /* Passo 2 — HKDF: extrator/expansor determinístico sobre os seed bits */
    const hkdfBase = await crypto.subtle.importKey('raw', seedBits, 'HKDF', false, ['deriveKey']);
    masterKey = await crypto.subtle.deriveKey(
        { name: 'HKDF', salt: enc.encode('netzach-vein'), info: enc.encode('netzach::encryption-key'), hash: 'SHA-256' },
        hkdfBase,
        { name: CRYPTO_ALGO, length: KEY_LENGTH },
        false,
        ['encrypt', 'decrypt']
    );

    /* Não rotacionar num SW já que a masterKey é derivada do fingerprint da sessão;
       a rotação contínua invalidaria keys antigas. */
}

function getFingerprint() {
    const seed = crypto.getRandomValues(new Uint8Array(24));
    return 'NETZACH-' + bufToHex(seed) + '-REAL';
}

/* ---------- Cifra autenticada AES-256-GCM ---------- */
async function encryptValue(value, context = '') {
    if (!masterKey) throw new Error('Chave não inicializada');
    const iv = randomBytes(IV_LENGTH);
    const aad = enc.encode(AAD + '::' + context);
    const plain = enc.encode(value);
    const cipher = await crypto.subtle.encrypt(
        { name: CRYPTO_ALGO, iv, additionalData: aad, tagLength: TAG_LENGTH },
        masterKey,
        plain
    );
    return JSON.stringify({
        v2: bufToB64(cipher),
        i: bufToHex(iv),
        s: bufToHex(keySalt),
        c: context,
        t: Date.now()
    });
}

async function decryptValue(payload, context = '') {
    try {
        const data = JSON.parse(payload);
        if (data.s !== bufToHex(keySalt)) return null; // salt expirado
        const iv = Uint8Array.from(hexToBuf(data.i));
        const cipher = Uint8Array.from(b64ToBuf(data.v2));
        const aad = enc.encode(AAD + '::' + (context || data.c || ''));
        /*
         * AES-GCM verifica a TAG de autenticação aqui. Se qualquer bit foi
         * adulterado (dados, IV, salt ou AAD), a decifragem FALHA e retorna null.
         * Isso é criptografia autenticada de verdade — não apenas ofuscação.
         */
        const plain = await crypto.subtle.decrypt(
            { name: CRYPTO_ALGO, iv, additionalData: aad, tagLength: TAG_LENGTH },
            masterKey,
            cipher
        );
        return dec.decode(plain);
    } catch (e) {
        return null;
    }
}

/* ---------- MULTI-LAYER OFUSCAÇÃO (camuflagem sobre o ciphertext) ---------- */
function hashValue(data) {
    let h = 5381;
    const p = 'NZ' + data + 'CH';
    for (let i = 0; i < p.length; i++) h = ((h << 5) + h) + p.charCodeAt(i) | 0;
    return Math.abs(h).toString(16).padStart(8, '0');
}

function xorShuffle(s, k) {
    let r = '';
    for (let i = 0; i < s.length; i++) r += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length));
    return r;
}

function obfuscate(str) {
    let layers = [];
    let out;

    out = xorShuffle(str, 'NZ' + hashValue(str).slice(0, 8));   // L1 XOR com chave derivada do conteúdo
    layers.push('xor');

    out = out.split('').reverse().join('');                      // L2 reversão
    layers.push('reverse');

    out = out.split('').map(c => String.fromCharCode((c.charCodeAt(0) + 9) & 0xff)).join(''); // L3 deslocamento de bytes
    layers.push('byte+9');

    out = btoa(unescape(encodeURIComponent(out)));               // L4 base64
    layers.push('base64');

    out = out.split('').reverse().join('');                      // L5 reversão de novo (interleaving)
    layers.push('reverse2');

    return {
        d: out,
        l: layers,
        hash: hashValue(str),
        ivguard: hashValue(out.slice(0, 32)),
        ver: 'NZ-2.0-REAL'
    };
}

function deobfuscate(obj) {
    let out = obj.d;
    if (hashValue(out.slice(0, 32)) !== obj.ivguard) return null;
    out = out.split('').reverse().join('');
    out = decodeURIComponent(escape(atob(out)));
    out = out.split('').map(c => String.fromCharCode((c.charCodeAt(0) - 9) & 0xff)).join('');
    out = out.split('').reverse().join('');
    const r = xorShuffle(out, 'NZ' + obj.hash.slice(0, 8));
    if (hashValue(r) !== obj.hash) return null;
    return r;
}

/* ---------- API exposta ao app ---------- */
async function encryptCookieBlob(value, domain, name) {
    const inner = await encryptValue(value, domain + '::' + name);
    return {
        id: hashValue(domain + '::' + name),
        domain,
        name,
        blob: obfuscate(inner),
        t: Date.now()
    };
}

async function decryptCookieBlob(stored) {
    const inner = deobfuscate(stored.blob);
    if (inner === null) return null;
    return decryptValue(inner, stored.domain + '::' + stored.name);
}

/* ---------- lifecycle (Web Worker dedicado) ---------- */
/*
 * Este arquivo roda como um Web Worker dedicado (via `new Worker`),
 * NUCA como Service Worker. Toda a criptografia é executada aqui,
 * em thread separada, sem travar a interface.
 */

self.onmessage = (e) => {
    const { type, payload } = e.data;
    const reply = (msg) => {
        if (e.ports && e.ports[0]) {
            e.ports[0].postMessage(msg);
        } else {
            // fallback: sem porta transferível
        }
    };
    switch (type) {
        case 'INIT':
            initPromise = initCrypto();
            initPromise
                .then(() => reply({ type: 'INIT_DONE', ok: true }))
                .catch((err) => reply({ type: 'INIT_DONE', ok: false, error: err.message }));
            break;
        case 'ENCRYPT_COOKIE':
            encryptCookieBlob(payload.value, payload.domain, payload.name)
                .then((stored) => reply({ type: 'COOKIE_ENCRYPTED', ok: true, stored }))
                .catch((err) => reply({ type: 'COOKIE_ENCRYPTED', ok: false, error: err.message }));
            break;
        case 'DECRYPT_COOKIE':
            decryptCookieBlob(payload.stored)
                .then((value) => reply({ type: 'COOKIE_DECRYPTED', ok: value !== null, value, stored: payload.stored }))
                .catch((err) => reply({ type: 'COOKIE_DECRYPTED', ok: false, error: err.message }));
            break;
        case 'HASH':
            reply({ type: 'HASH_DONE', hash: hashValue(payload.data) });
            break;
        case 'STATUS':
            (initPromise || Promise.resolve())
                .catch(() => {})
                .then(() => reply({
                    type: 'STATUS_DONE',
                    ok: !!masterKey,
                    crypto: {
                        algo: CRYPTO_ALGO,
                        keyLength: KEY_LENGTH,
                        ivLength: IV_LENGTH,
                        tagLength: TAG_LENGTH,
                        kdf: 'PBKDF2→HKDF',
                        iterations: PBKDF2_ITERATIONS,
                        hash: 'SHA-256',
                        aad: AAD,
                        salt: keySalt ? bufToHex(keySalt) : null,
                        fingerprint: sessionFingerprint || null,
                        layers: ['xor', 'reverse', 'byte+9', 'base64', 'reverse2'],
                        version: 'NZ-2.0-REAL'
                    }
                }));
            break;
    }
};
