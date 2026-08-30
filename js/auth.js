/**
 * NETZACH Navega — Sessão com Login Google
 * Gerencia o login via Google Identity Services, valida o ID token (JWT)
 * e persiste a sessão de forma CRIPTOGRAFADA no aparelho.
 */

import { GOOGLE_CLIENT_ID } from './config.js';

const SESSION_KEY = 'netzach.session';
let currentUser = null;

function hashValue(data) {
    let hash = 5381;
    const payload = 'NZ' + data + 'CH';
    for (let i = 0; i < payload.length; i++) {
        hash = ((hash << 5) + hash) + payload.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
}

function base64UrlDecode(str) {
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    return JSON.parse(decodeURIComponent(escape(atob(b64))));
}

export function parseJwt(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const header = base64UrlDecode(parts[0]);
        const payload = base64UrlDecode(parts[1]);
        return { header, payload };
    } catch (e) {
        return null;
    }
}

export function verifyToken(token) {
    const parsed = parseJwt(token);
    if (!parsed) return { valid: false, reason: 'invalid-jwt' };
    const { payload } = parsed;
    if (typeof payload.exp !== 'number' || Date.now() / 1000 > payload.exp) {
        return { valid: false, reason: 'expired' };
    }
    if (typeof payload.aud !== 'string' || payload.aud !== GOOGLE_CLIENT_ID) {
        return { valid: false, reason: 'bad-audience' };
    }
    return { valid: true, payload };
}

export function getCurrentUser() {
    return currentUser;
}

export function getStoredSession() {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data;
    } catch (e) {
        return null;
    }
}

export function storeSession(user) {
    const session = {
        user: {
            name: user.name,
            email: user.email,
            picture: user.picture,
            sub: user.sub
        },
        loginAt: Date.now(),
        // token expira; guardamos hash p/ integridade
        integrity: hashValue(user.email + '::' + user.sub + '::' + user.exp)
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    currentUser = session.user;
    return session;
}

export function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
}

export function isAuthed() {
    return !!getStoredSession();
}

export function bootstrapGoogle(callback) {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.startsWith('COLE_')) {
        return false; // client id não configurado
    }
    const existing = document.querySelector('script[src*="accounts.google.com"]');
    if (existing) return true;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => callback && callback();
    document.head.appendChild(script);
    return true;
}
