/* vault.js — criptarea datelor cu parola familiei.
   AES-256-GCM, cheie derivată din parolă cu PBKDF2-SHA256 (600.000 iterații, salt aleator).
   Aceeași „anvelopă” criptată e folosită în localStorage, în Google Drive și la export.
   Fără parolă datele NU pot fi recuperate. */
(function (global) {
  'use strict';

  const ITER = 600000;
  const SESSION_KEY = 'fw_vault_session'; // cheia (nu parola), doar pe durata sesiunii de browser
  const te = new TextEncoder();
  const td = new TextDecoder();

  function b64(buf) {
    const u = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
    return btoa(s);
  }
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  let key = null;      // CryptoKey AES-GCM
  let salt = null;     // base64
  let iter = ITER;
  let password = null; // doar în memorie, ca să putem citi o anvelopă cu alt salt (ex. parolă schimbată pe alt dispozitiv)
  const known = new Map(); // salt → cheie: cheile folosite în această sesiune (ex. cea dinaintea schimbării parolei)

  const supported = () => !!(global.crypto && crypto.subtle && crypto.getRandomValues);
  const isEnvelope = (x) => !!x && typeof x === 'object' && x.fw_vault === 1 && typeof x.ct === 'string' && typeof x.salt === 'string';
  const enabled = () => !!key;

  function needPassword(env) {
    const e = new Error('Este nevoie de parola familiei pentru a decripta datele.');
    e.code = 'NEED_PASSWORD';
    e.envelope = env;
    return e;
  }

  async function deriveKey(pw, saltB64, it) {
    const base = await crypto.subtle.importKey('raw', te.encode(String(pw).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: unb64(saltB64), iterations: it },
      base, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );
  }

  async function saveSession() {
    try {
      const raw = await crypto.subtle.exportKey('raw', key);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ salt, iter, key: b64(raw) }));
    } catch (e) { /* sesiunea nu e esențială */ }
  }

  async function adopt(k, s, it, pw) {
    key = k; salt = s; iter = it;
    known.set(s + ':' + it, k);
    if (pw) password = pw;
    await saveSession();
  }

  /** Reia cheia salvată în sesiunea curentă de browser (fără să ceară parola la reîncărcare). */
  async function restoreSession() {
    try {
      const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (!s || !s.key) return false;
      key = await crypto.subtle.importKey('raw', unb64(s.key), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
      salt = s.salt; iter = s.iter || ITER;
      known.set(salt + ':' + iter, key);
      return true;
    } catch (e) { return false; }
  }

  /** Activează criptarea (sau schimbă parola): salt nou + cheie nouă. */
  async function setup(pw) {
    const s = b64(crypto.getRandomValues(new Uint8Array(16)));
    await adopt(await deriveKey(pw, s, ITER), s, ITER, pw);
  }

  async function encrypt(obj) {
    if (!key) throw new Error('Datele sunt blocate.');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(JSON.stringify(obj)));
    return {
      fw_vault: 1, alg: 'AES-256-GCM', kdf: 'PBKDF2-SHA256', iter, salt, iv: b64(iv), ct: b64(ct),
      // necriptat, ca sincronizarea să poată compara versiunile fără parolă
      last_updated: (obj && obj.metadata && obj.metadata.last_updated) || null
    };
  }

  async function decryptWith(k, env) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(env.iv) }, k, unb64(env.ct));
    return JSON.parse(td.decode(pt));
  }

  /** Decriptează cu cheia curentă; dacă anvelopa are alt salt și știm parola, o adoptă. Altfel aruncă NEED_PASSWORD. */
  async function decrypt(env) {
    const it = env.iter || ITER;
    if (key && env.salt === salt && it === iter) {
      try { return await decryptWith(key, env); } catch (e) { /* cheie diferită — parola a fost schimbată */ }
    }
    // O cheie mai veche din această sesiune (ex. fișierul din Drive încă e criptat cu parola dinaintea schimbării)
    const old = known.get(env.salt + ':' + it);
    if (old && old !== key) {
      try { return await decryptWith(old, env); } catch (e) { /* nu se potrivește */ }
    }
    if (password) {
      try {
        const k = await deriveKey(password, env.salt, it);
        const data = await decryptWith(k, env);
        await adopt(k, env.salt, it, password);
        return data;
      } catch (e) { /* parola din memorie nu se potrivește */ }
    }
    throw needPassword(env);
  }

  /** Încearcă parola pe o anvelopă; dacă e corectă, o adoptă ca parolă a familiei pe acest dispozitiv. */
  async function unlock(pw, env) {
    const it = env.iter || ITER;
    const k = await deriveKey(pw, env.salt, it);
    let data;
    try { data = await decryptWith(k, env); } catch (e) { return null; }
    await adopt(k, env.salt, it, pw);
    return data;
  }

  /** Deschide o anvelopă cu o parolă FĂRĂ s-o adopte (ex. import dintr-un backup vechi). */
  async function open(pw, env) {
    try { return await decryptWith(await deriveKey(pw, env.salt, env.iter || ITER), env); } catch (e) { return null; }
  }

  async function verifyPassword(pw) {
    if (!key || !salt) return false;
    const a = new Uint8Array(await crypto.subtle.exportKey('raw', await deriveKey(pw, salt, iter)));
    const b = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }

  /** Uită cheia pe acest dispozitiv (blocare / dezactivare). */
  function lock() {
    key = null; salt = null; iter = ITER; password = null;
    known.clear();
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  global.FWVault = { ITER, supported, isEnvelope, enabled, setup, encrypt, decrypt, unlock, open, verifyPassword, restoreSession, lock };
})(window);
