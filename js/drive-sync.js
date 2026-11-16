/* drive-sync.js — Google Identity Services (OAuth2 token) + Drive API v3 în appDataFolder */
(function (global) {
  'use strict';

  const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
  const FILE_NAME = 'family_wealth_data.json';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const FILE_ID_KEY = 'fw_drive_file_id';
  const TOKEN_KEY = 'fw_drive_token'; // access_token (doar drive.appdata, valabil ~1h) — supraviețuiește reîncărcării paginii

  let token = null;
  let expiresAt = 0;
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (t && t.token && Date.now() < t.expiresAt) { token = t.token; expiresAt = t.expiresAt; }
  } catch (e) { /* ignore */ }
  function saveToken() {
    try { token ? localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt })) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }
  let gisPromise = null;
  let fileId = safeGet(FILE_ID_KEY);
  let queue = Promise.resolve(); // serializează operațiile Drive

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function setFileId(id) {
    fileId = id || null;
    try { id ? localStorage.setItem(FILE_ID_KEY, id) : localStorage.removeItem(FILE_ID_KEY); } catch (e) { /* ignore */ }
  }

  class DriveError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }

  /** Încarcă scriptul GIS o singură dată. */
  function loadGis() {
    if (global.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (gisPromise) return gisPromise;
    gisPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { gisPromise = null; reject(new DriveError('Nu s-a putut încărca Google Identity Services. Ești offline?')); };
      document.head.appendChild(s);
    });
    return gisPromise;
  }

  /** Obține un access_token. Trebuie apelat dintr-un gest al utilizatorului (click), altfel popup-ul e blocat. */
  async function connect(clientId) {
    if (!clientId) throw new DriveError('Lipsește Google OAuth Client ID (vezi Setări).');
    await loadGis();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) return reject(new DriveError(resp.error_description || resp.error));
          if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE)) {
            return reject(new DriveError('Permisiunea pentru folderul aplicației (drive.appdata) nu a fost acordată.'));
          }
          token = resp.access_token;
          expiresAt = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
          saveToken();
          resolve();
        },
        error_callback: (err) => {
          const msg = err && err.type === 'popup_closed' ? 'Fereastra de autentificare a fost închisă.'
            : err && err.type === 'popup_failed_to_open' ? 'Browserul a blocat fereastra de autentificare.'
            : (err && err.message) || 'Autentificare Google eșuată.';
          reject(new DriveError(msg));
        }
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  const hasValidToken = () => !!token && Date.now() < expiresAt;

  async function api(url, opts = {}) {
    if (!hasValidToken()) throw new DriveError('Sesiunea Google a expirat — reconectează-te.', 401);
    const res = await fetch(url, Object.assign({}, opts, {
      headers: Object.assign({}, opts.headers || {}, { Authorization: 'Bearer ' + token })
    }));
    if (res.status === 401) { token = null; saveToken(); throw new DriveError('Sesiunea Google a expirat — reconectează-te.', 401); }
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); msg = (j.error && j.error.message) || msg; } catch (e) { /* ignore */ }
      throw new DriveError('Google Drive: ' + msg, res.status);
    }
    return res;
  }

  async function findFile() {
    const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
    const res = await api(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)&orderBy=modifiedTime%20desc&pageSize=10`);
    const j = await res.json();
    const f = (j.files && j.files[0]) || null;
    setFileId(f ? f.id : null);
    return f;
  }

  async function download(id) {
    const res = await api(`${API}/files/${encodeURIComponent(id)}?alt=media`);
    return res.json();
  }

  async function create(data) {
    const boundary = 'fw' + Math.random().toString(36).slice(2);
    const meta = { name: FILE_NAME, parents: ['appDataFolder'], mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(data)}\r\n` +
      `--${boundary}--`;
    const res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body
    });
    const j = await res.json();
    setFileId(j.id);
    return j.id;
  }

  async function update(id, data) {
    await api(`${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify(data)
    });
  }

  function serialize(fn) {
    const p = queue.then(fn, fn);
    queue = p.catch(() => {});
    return p;
  }

  async function pushInner(data) {
    let id = fileId;
    if (!id) { const f = await findFile(); id = f && f.id; }
    if (!id) { await create(data); return; }
    try {
      await update(id, data);
    } catch (e) {
      if (e.status === 404) { setFileId(null); await create(data); } else { throw e; }
    }
  }

  /** Auto-save: PATCH dacă fișierul există, altfel POST. */
  const push = (data) => serialize(() => pushInner(data));

  const isValidPayload = (d) => d && typeof d === 'object' && d.metadata && Array.isArray(d.family_members);

  /** Reconciliere: versiunea cu last_updated mai nou câștigă. */
  const sync = (local) => serialize(async () => {
    const f = await findFile();
    if (!f) { await create(local); return { action: 'pushed' }; }
    const remote = await download(f.id);
    if (!isValidPayload(remote)) { await update(f.id, local); return { action: 'pushed' }; }
    const lt = Date.parse(local && local.metadata && local.metadata.last_updated) || 0;
    const rt = Date.parse(remote.metadata.last_updated) || 0;
    if (rt > lt) return { action: 'pulled', data: remote };
    if (lt > rt) { await update(f.id, local); return { action: 'pushed' }; }
    return { action: 'none' };
  });

  /** Deconectează DOAR acest dispozitiv. Nu folosim oauth2.revoke: acela retrage accesul aplicației
   *  pentru tot contul Google și deconecta toate celelalte dispozitive. */
  function disconnect() {
    token = null;
    expiresAt = 0;
    saveToken();
    setFileId(null);
  }

  global.DriveSync = {
    FILE_NAME, SCOPE,
    preload: () => loadGis().catch(() => {}),
    connect, hasValidToken, sync, push, disconnect,
    getFileId: () => fileId
  };
})(window);
