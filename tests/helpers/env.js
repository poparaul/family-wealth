// Mediu de test: pornește aplicația reală în jsdom, cu localStorage/sessionStorage proprii și un Google Drive simulat.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { webcrypto } = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const SCRIPTS = ['js/calculators.js', 'js/merge.js', 'js/vault.js', 'js/drive-sync.js', 'js/app.js'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const clone = (x) => JSON.parse(JSON.stringify(x));

function memStorage(map = new Map()) {
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
}

/** Google Drive simulat: folderul privat (appDataFolder), fișiere vizibile, permisiuni, backup-uri, cursuri BCE. */
function createDrive({ email = 'andrei@example.com', rates = { RON: 5.1, USD: 1.1 } } = {}) {
  const st = { files: new Map(), next: 1, calls: [], perms: new Map(), sheets: new Map(), email, rates };
  const ok = (b, status = 200) => ({ ok: true, status, json: async () => b });
  const fail = (status, message) => ({ ok: false, status, json: async () => ({ error: { message } }) });
  const parseMultipart = (body) => {
    const parts = body.split('\r\n\r\n');
    return { meta: JSON.parse(parts[1].split('\r\n--')[0]), content: parts[2].split('\r\n--')[0] };
  };
  const fetch = async (url, opts = {}) => {
    const method = opts.method || 'GET';
    st.calls.push(`${method} ${url}`);
    const u = new URL(url);
    if (u.host === 'api.frankfurter.dev') return ok({ amount: 1, base: 'EUR', date: '2026-01-02', rates: st.rates });
    if (u.host === 'sheets.googleapis.com') {
      if (method === 'POST' && u.pathname === '/v4/spreadsheets') {
        const body = JSON.parse(opts.body);
        const id = 'S' + st.next++;
        st.sheets.set(id, { body, values: [] });
        st.files.set(id, { id, name: body.properties.title, appdata: false, content: '{}', createdTime: new Date().toISOString(), trashed: false });
        st.perms.set(id, [{ id: 'p0', emailAddress: st.email, role: 'owner' }]);
        return ok({ spreadsheetId: id, properties: { title: body.properties.title } });
      }
      const mv = u.pathname.match(/^\/v4\/spreadsheets\/([^/]+)\/values\/(.+)$/);
      if (mv && st.sheets.has(decodeURIComponent(mv[1]))) return ok({ values: st.sheets.get(decodeURIComponent(mv[1])).values });
      return fail(404, 'Spreadsheet not found');
    }
    if (u.pathname.endsWith('/about')) return ok({ user: { emailAddress: st.email } });
    const m = u.pathname.match(/\/files\/([^/]+)(\/permissions)?$/);
    if (method === 'GET' && u.pathname.endsWith('/drive/v3/files')) {
      const q = u.searchParams.get('q') || '';
      const nameEq = q.match(/name='([^']+)'/), nameHas = q.match(/name contains '([^']+)'/);
      let list = [...st.files.values()].filter((f) => f.appdata === (u.searchParams.get('spaces') === 'appDataFolder') && !f.trashed);
      if (nameEq) list = list.filter((f) => f.name === nameEq[1]);
      if (nameHas) list = list.filter((f) => f.name.includes(nameHas[1]));
      list.sort((a, b) => b.createdTime.localeCompare(a.createdTime));
      return ok({ files: list.map((f) => ({ id: f.id, name: f.name, createdTime: f.createdTime, size: String(f.content.length) })) });
    }
    if (method === 'POST' && u.pathname.endsWith('/upload/drive/v3/files')) {
      const { meta, content } = parseMultipart(opts.body);
      const id = 'F' + st.next++;
      const created = new Date(Date.now() + st.next).toISOString();
      st.files.set(id, { id, name: meta.name, appdata: (meta.parents || []).includes('appDataFolder'), content, createdTime: created, trashed: false });
      st.perms.set(id, [{ id: 'p0', emailAddress: st.email, role: 'owner' }]);
      return ok({ id, name: meta.name, createdTime: created });
    }
    if (m) {
      const f = st.files.get(decodeURIComponent(m[1]));
      if (!f) return fail(404, 'File not found');
      if (m[2]) {
        if (method === 'POST') { const b = JSON.parse(opts.body); st.perms.get(f.id).push({ id: 'p' + Math.random(), emailAddress: b.emailAddress, role: b.role }); return ok({ id: 'p1' }); }
        return ok({ permissions: st.perms.get(f.id) });
      }
      if (method === 'DELETE') { st.files.delete(f.id); return ok({}, 204); }
      if (method === 'PATCH') { f.content = opts.body; return ok({}); }
      if (u.searchParams.get('alt') === 'media') return ok(JSON.parse(f.content));
      return ok({ id: f.id, name: f.name, trashed: f.trashed, owners: [{ emailAddress: st.email }] });
    }
    return fail(400, 'Neașteptat în test: ' + url);
  };
  return {
    st, fetch,
    put(content, { name = 'family_wealth_data.json', appdata = true } = {}) {
      const id = 'F' + st.next++;
      st.files.set(id, { id, name, appdata, content: JSON.stringify(content), createdTime: new Date().toISOString(), trashed: false });
      st.perms.set(id, [{ id: 'p0', emailAddress: st.email, role: 'owner' }]);
      return id;
    },
    appFile() { return [...st.files.values()].find((f) => f.appdata && f.name === 'family_wealth_data.json'); },
    json(id) { return JSON.parse(st.files.get(id).content); },
    backups() { return [...st.files.values()].filter((f) => f.appdata && f.name.startsWith('family_wealth_backup_')); }
  };
}

/** Pornește aplicația. `local`/`session` permit „reîncărcarea” aceluiași dispozitiv. */
async function boot({ data, profile = 'm_a', settings, drive, token = !!drive, local = new Map(), session = new Map(), base, online = true } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<script src="[^"]+"><\/script>/g, '');
  const virtualConsole = new VirtualConsole(); // ignoră „Not implemented: navigation” de la descărcări
  const dom = new JSDOM(html, { url: 'https://example.github.io/app/', runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const w = dom.window;
  Object.defineProperty(w, 'localStorage', { value: memStorage(local) });
  Object.defineProperty(w, 'sessionStorage', { value: memStorage(session) });
  Object.defineProperty(w, 'crypto', { value: webcrypto });
  Object.defineProperty(w.navigator, 'onLine', { value: online, configurable: true, writable: true });
  w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
  w.scrollTo = () => {};
  const blobs = [];
  w.URL.createObjectURL = (b) => { blobs.push(b); return 'blob:test'; };
  w.URL.revokeObjectURL = () => {};
  w.fetch = drive ? drive.fetch : async () => { throw new Error('offline în test'); };
  if (data !== undefined) local.set('fw_data', JSON.stringify(data));
  if (profile) local.set('fw_profile', profile);
  if (settings) local.set('fw_settings', JSON.stringify(settings));
  if (base) local.set('fw_sync_base', JSON.stringify(base));
  if (token) local.set('fw_drive_token', JSON.stringify({ token: 't', expiresAt: Date.now() + 3600e3, fileScope: true }));
  const errors = [];
  w.addEventListener('error', (e) => errors.push(e.message));
  for (const f of SCRIPTS) w.eval(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  await wait(300);

  const doc = w.document;
  const q = (s) => doc.querySelector(s);
  const qa = (s) => [...doc.querySelectorAll(s)];
  // jsdom nu are form.<nume>; browserele reale da
  const named = (form) => { [...form.elements].forEach((el) => { if (el.name && !(el.name in form)) Object.defineProperty(form, el.name, { value: el, configurable: true }); }); return form; };
  const api = {
    w, doc, q, qa, local, session, errors, blobs, drive, wait,
    click: (el) => { if (!el) throw new Error('element lipsă pentru click'); el.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); },
    mousedown: (el) => el.dispatchEvent(new w.MouseEvent('mousedown', { bubbles: true, cancelable: true })),
    key: (el, key) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })),
    named,
    submit: (form) => named(form).dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })),
    text: () => doc.body.textContent.replace(/\s/g, ' '),
    nav: async (view) => { api.click(q(`[data-view="${view}"]`)); await wait(30); },
    modal: () => { const f = q('#modal-root [data-modal-form]'); return f ? named(f) : null; },
    confirm: async () => { await wait(20); api.submit(q('#modal-root [data-modal-form]')); await wait(40); },
    stored: () => JSON.parse(local.get('fw_data')),
    settings: () => JSON.parse(local.get('fw_settings') || '{}'),
    blobText: (b) => new Promise((res) => { const r = new w.FileReader(); r.onload = () => res(r.result); r.readAsText(b); })
  };
  return api;
}

module.exports = { boot, createDrive, wait, clone, memStorage, ROOT };
