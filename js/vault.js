/**
 * NETZACH Navega — Armazenamento Seguro (IndexedDB)
 * Persiste apenas o BLOB ofuscado do cookie. O valor original
 * JAMAIS é gravado em disco; é reconstituído só em memória
 * mediante decrypt pelo Service Worker.
 */

const DB_NAME = 'netzach-vault';
const DB_VERSION = 1;
const STORE_COOKIES = 'cookies';
const STORE_META = 'metadata';

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_COOKIES)) {
                const store = db.createObjectStore(STORE_COOKIES, { keyPath: 'id' });
                store.createIndex('domain', 'domain', { unique: false });
                store.createIndex('name', 'name', { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_META)) {
                db.createObjectStore(STORE_META, { keyPath: 'key' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    return dbPromise;
}

async function putCookie(stored) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COOKIES, 'readwrite');
        tx.objectStore(STORE_COOKIES).put(stored);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function getCookie(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COOKIES, 'readonly');
        const req = tx.objectStore(STORE_COOKIES).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function getAllCookies() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COOKIES, 'readonly');
        const req = tx.objectStore(STORE_COOKIES).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function deleteCookie(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COOKIES, 'readwrite');
        tx.objectStore(STORE_COOKIES).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function clearCookies() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_COOKIES, 'readwrite');
        tx.objectStore(STORE_COOKIES).clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function setMeta(key, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readwrite');
        tx.objectStore(STORE_META).put({ key, value });
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

async function getMeta(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_META, 'readonly');
        const req = tx.objectStore(STORE_META).get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
    });
}

export {
    openDB, putCookie, getCookie, getAllCookies,
    deleteCookie, clearCookies, setMeta, getMeta,
    STORE_COOKIES, STORE_META
};
