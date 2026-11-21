/* drive-sync.js — Google Identity Services (OAuth2 token) + Drive API v3.
   Două moduri: folderul ascuns al aplicației (appDataFolder, doar contul conectat) sau un fișier
   partajat vizibil în Drive (scope drive.file: aplicația vede DOAR fișierele create de ea sau alese
   explicit din selectorul Google, nu restul Drive-ului). */
(function (global) {
  'use strict';

  const SCOPE_APPDATA = 'https://www.googleapis.com/auth/drive.appdata';
  const SCOPE_FILE = 'https://www.googleapis.com/auth/drive.file';
  const SCOPE = SCOPE_APPDATA + ' ' + SCOPE_FILE;
  const FILE_NAME = 'family_wealth_data.json';
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const FILE_ID_KEY = 'fw_drive_file_id';
  const TOKEN_KEY = 'fw_drive_token'; // access_token (doar drive.appdata, valabil ~1h) — supraviețuiește reîncărcării paginii

  let token = null;
  let expiresAt = 0;
  let fileScope = false; // utilizatorul a acordat și drive.file (necesar pentru fișierul partajat)
  try {
    const t = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
    if (t && t.token && Date.now() < t.expiresAt) { token = t.token; expiresAt = t.expiresAt; fileScope = !!t.fileScope; }
  } catch (e) { /* ignore */ }
  function saveToken() {
    try { token ? localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt, fileScope })) : localStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
  }
  // Ținta sincronizării: { mode: 'appdata' } sau { mode: 'shared', fileId }
  let target = { mode: 'appdata', fileId: null };
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
  async function connect(clientId, opts = {}) {
    if (!clientId) throw new DriveError('Lipsește Google OAuth Client ID (vezi Setări).');
    await loadGis();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        hint: opts.hint || undefined, // contul ales anterior (nu cel implicit al browserului)
        callback: (resp) => {
          if (resp.error) return reject(new DriveError(resp.error_description || resp.error));
          if (!google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE_APPDATA)) {
            return reject(new DriveError('Permisiunea pentru folderul aplicației (drive.appdata) nu a fost acordată.'));
          }
          fileScope = google.accounts.oauth2.hasGrantedAllScopes(resp, SCOPE_FILE);
          if (target.mode === 'shared' && !fileScope) {
            return reject(new DriveError('Pentru fișierul partajat trebuie bifată și permisiunea „fișierele Drive folosite cu această aplicație”.'));
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
      client.requestAccessToken({ prompt: opts.selectAccount ? 'select_account' : '' });
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

  /** Emailul contului Google conectat (Drive about.get funcționează cu scope-ul drive.appdata). */
  async function accountEmail() {
    const res = await api(`${API}/about?fields=user(emailAddress)`);
    const j = await res.json();
    return (j.user && j.user.emailAddress) || null;
  }

  async function findFile() {
    if (target.mode === 'shared') {
      if (!target.fileId) throw new DriveError('Nu e ales niciun fișier partajat.');
      let res;
      try { res = await api(`${API}/files/${encodeURIComponent(target.fileId)}?fields=id,name,trashed`); }
      catch (e) { if (e.status === 404) throw new DriveError('Fișierul partajat nu mai există sau nu mai ai acces la el.', 404); throw e; }
      const j = await res.json();
      if (j.trashed) throw new DriveError('Fișierul partajat a fost mutat în coșul de gunoi din Drive. Restaurează-l din coș.');
      return j;
    }
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

  /* Criptare (vault.js): ce pleacă spre Drive e criptat dacă parola familiei e activă; ce vine se decriptează. */
  const V = () => global.FWVault;
  const isEnc = (x) => !!(V() && V().isEnvelope(x));
  const encodeOut = async (data) => (V() && V().enabled() ? V().encrypt(data) : data);
  async function decodeIn(raw) {
    if (!isEnc(raw)) return raw;
    return V().decrypt(raw); // aruncă NEED_PASSWORD dacă nu avem parola potrivită
  }

  async function pushInner(data, opts = {}) {
    let id = target.mode === 'shared' ? target.fileId : fileId;
    if (!id || target.mode === 'shared') { const f = await findFile(); id = f && f.id; }
    // Un dispozitiv fără parolă nu are voie să suprascrie cu date necriptate un fișier criptat.
    if (id && !(V() && V().enabled()) && !opts.allowPlain) {
      let remote = null;
      try { remote = await download(id); } catch (e) { if (e.status !== 404) throw e; }
      if (isEnc(remote)) await V().decrypt(remote); // → NEED_PASSWORD
    }
    const body = await encodeOut(data);
    if (!id) { await create(body); return; }
    try {
      await update(id, body);
    } catch (e) {
      if (e.status === 404 && target.mode !== 'shared') { setFileId(null); await create(body); } else { throw e; }
    }
  }

  /* ---------- Backup-uri (mereu în folderul privat appDataFolder al contului conectat) ---------- */
  const BACKUP_PREFIX = 'family_wealth_backup_';
  async function listBackups() {
    const q = encodeURIComponent(`name contains '${BACKUP_PREFIX}' and trashed=false`);
    const res = await api(`${API}/files?spaces=appDataFolder&q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime%20desc&pageSize=50`);
    return (await res.json()).files || [];
  }
  async function createBackup(data) {
    const boundary = 'fw' + Math.random().toString(36).slice(2);
    const meta = { name: `${BACKUP_PREFIX}${new Date().toISOString().slice(0, 10)}.json`, parents: ['appDataFolder'], mimeType: 'application/json' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(await encodeOut(data))}\r\n` +
      `--${boundary}--`;
    const res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,name,createdTime`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body
    });
    return res.json();
  }
  async function readBackup(id) { return decodeIn(await download(id)); } // NEED_PASSWORD dacă e criptat cu altă parolă
  async function deleteFile(id) { await api(`${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' }); }

  /* ---------- Google Sheets (dețineri de acțiuni cu prețuri GOOGLEFINANCE) ---------- */
  const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
  async function createSpreadsheet(body) {
    const res = await api(SHEETS, { method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' }, body: JSON.stringify(body) });
    return res.json(); // { spreadsheetId, spreadsheetUrl, properties: { title } }
  }
  async function readSheet(id, range) {
    const res = await api(`${SHEETS}/${encodeURIComponent(id)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`);
    return (await res.json()).values || [];
  }

  /* ---------- Fișier partajat ---------- */
  /** Creează în „Drive-ul meu” un fișier vizibil cu datele (criptate dacă e activă parola familiei). */
  async function createSharedFile(data, name) {
    const boundary = 'fw' + Math.random().toString(36).slice(2);
    const meta = { name, mimeType: 'application/json', description: 'Datele aplicației Patrimoniu Familial. Nu modifica manual.' };
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(await encodeOut(data))}\r\n` +
      `--${boundary}--`;
    const res = await api(`${UPLOAD}/files?uploadType=multipart&fields=id,name`, {
      method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body
    });
    return res.json();
  }

  /** Dă acces de editare unei persoane (primește email de la Google). */
  async function shareFile(id, email) {
    const res = await api(`${API}/files/${encodeURIComponent(id)}/permissions?sendNotificationEmail=true&fields=id,emailAddress,role`, {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ type: 'user', role: 'writer', emailAddress: email })
    });
    return res.json();
  }

  async function listPermissions(id) {
    const res = await api(`${API}/files/${encodeURIComponent(id)}/permissions?fields=permissions(id,emailAddress,displayName,role)`);
    return (await res.json()).permissions || [];
  }

  async function fileMeta(id) {
    const res = await api(`${API}/files/${encodeURIComponent(id)}?fields=id,name,owners(emailAddress,displayName),trashed`);
    return res.json();
  }

  /* Selectorul de fișiere Google (Picker): prin el utilizatorul alege fișierul partajat cu el,
     iar aplicația primește acces doar la acel fișier. */
  let pickerPromise = null;
  function loadPicker() {
    if (global.google && google.picker) return Promise.resolve();
    if (pickerPromise) return pickerPromise;
    pickerPromise = new Promise((resolve, reject) => {
      const done = () => global.gapi.load('picker', { callback: resolve, onerror: () => reject(new DriveError('Selectorul Google nu s-a putut încărca.')) });
      if (global.gapi) return done();
      const s = document.createElement('script');
      s.src = 'https://apis.google.com/js/api.js';
      s.async = true;
      s.onload = done;
      s.onerror = () => { pickerPromise = null; reject(new DriveError('Selectorul Google nu s-a putut încărca. Ești offline?')); };
      document.head.appendChild(s);
    });
    return pickerPromise;
  }

  /** Deschide selectorul; întoarce { id, name } sau null dacă utilizatorul renunță. */
  async function pickFile({ apiKey, appId, mimeTypes = 'application/json', title = 'Alege fișierul cu datele familiei' }) {
    if (!hasValidToken()) throw new DriveError('Conectează-te întâi la Google Drive.', 401);
    if (!fileScope) throw new DriveError('Reconectează Google Drive și acceptă permisiunea pentru fișierele folosite cu aplicația.', 401);
    if (!apiKey) throw new DriveError('Lipsește cheia Google API (vezi Setări).');
    await loadPicker();
    return new Promise((resolve) => {
      const shared = new google.picker.DocsView(google.picker.ViewId.DOCS).setOwnedByMe(false).setMimeTypes(mimeTypes).setMode(google.picker.DocsViewMode.LIST);
      const mine = new google.picker.DocsView(google.picker.ViewId.DOCS).setOwnedByMe(true).setMimeTypes(mimeTypes).setMode(google.picker.DocsViewMode.LIST);
      const picker = new google.picker.PickerBuilder()
        .addView(shared).addView(mine)
        .setOAuthToken(token).setDeveloperKey(apiKey).setAppId(appId)
        .setTitle(title).setLocale('ro')
        .setCallback((d) => {
          if (d.action === google.picker.Action.PICKED && d.docs && d.docs[0]) resolve({ id: d.docs[0].id, name: d.docs[0].name });
          else if (d.action === google.picker.Action.CANCEL) resolve(null);
        })
        .build();
      picker.setVisible(true);
    });
  }

  /** Auto-save: PATCH dacă fișierul există, altfel POST. */
  const push = (data, opts) => serialize(() => pushInner(data, opts));

  const isValidPayload = (d) => d && typeof d === 'object' && d.metadata && Array.isArray(d.family_members);

  /** Reconciliere: versiunea cu last_updated mai nou câștigă. */
  const sync = (local, opts = {}) => serialize(async () => {
    const f = await findFile();
    if (!f) { await create(await encodeOut(local)); return { action: 'pushed', data: local }; }
    const remote = await decodeIn(await download(f.id));
    if (!isValidPayload(remote)) { await update(f.id, await encodeOut(local)); return { action: 'pushed', data: local }; }
    if (opts.preferRemote) return { action: 'pulled', data: remote }; // cont nou/schimbat: Drive-ul e sursa de adevăr

    // Cu bază (versiunea de la ultima sincronizare a acestui dispozitiv): îmbinare în 3 direcții.
    if (opts.base && global.FWMerge) {
      const res = global.FWMerge.merge(opts.base, local, remote);
      if (res.changedRemote) await update(f.id, await encodeOut(res.data));
      const action = res.changedRemote ? (res.changedLocal ? 'merged' : 'pushed') : (res.changedLocal ? 'pulled' : 'none');
      return { action, data: res.data, conflicts: res.conflicts };
    }

    // Fără bază (prima sincronizare pe acest dispozitiv): regula veche — fișierul mai nou câștigă.
    // O reuniune aici ar putea readuce conturi șterse între timp pe alt dispozitiv.
    const lt = Date.parse(local && local.metadata && local.metadata.last_updated) || 0;
    const rt = Date.parse(remote.metadata.last_updated) || 0;
    if (rt > lt) return { action: 'pulled', data: remote };
    if (lt > rt) { await update(f.id, await encodeOut(local)); return { action: 'pushed', data: local }; }
    return { action: 'none', data: remote };
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
    connect, hasValidToken, sync, push, disconnect, accountEmail,
    setTarget: (t) => { target = { mode: t && t.mode === 'shared' ? 'shared' : 'appdata', fileId: (t && t.fileId) || null }; },
    getTarget: () => Object.assign({}, target),
    hasFileScope: () => fileScope,
    createSharedFile: (data, name) => serialize(() => createSharedFile(data, name)),
    shareFile, listPermissions, fileMeta, pickFile,
    listBackups, readBackup, deleteFile, createSpreadsheet, readSheet,
    createBackup: (data) => serialize(() => createBackup(data)),
    getFileId: () => fileId
  };
})(window);
