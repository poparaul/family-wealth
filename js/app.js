/* app.js — state management, randare UI și acțiuni */
(function () {
  'use strict';

  /* ======================================================================
     CONFIGURARE
     ====================================================================== */
  const CONFIG = {
    // Opțional: pune aici OAuth Client ID-ul ca să nu-l introduci manual pe fiecare dispozitiv.
    // Ex: '1234567890-abc.apps.googleusercontent.com'
    GOOGLE_CLIENT_ID: '224663736671-oia6ij7slsdnmqpbjhibdfe4lcpp6qpl.apps.googleusercontent.com'
  };

  const LS = { DATA: 'fw_data', PROFILE: 'fw_profile', SETTINGS: 'fw_settings', ANALYSIS: 'fw_analysis' };
  const SS_UNLOCK = 'fw_unlocked_profile'; // profilul deblocat cu parolă în sesiunea curentă de browser

  const ROLE_LABELS = { admin: 'Administrator', viewer: 'Vizualizare', viewer_restricted: 'Modul Copil' };
  const ROLE_HINTS = {
    admin: 'Acces complet: editare, Google Drive, ghid de succesiune',
    viewer: 'Vede doar activele la care participă',
    viewer_restricted: 'Vede pușculița și investițiile pe numele lui'
  };
  const MEMBER_COLORS = Calc.PALETTE; // al 9-lea membru și următorii primesc gri („Alții”), nu o nuanță generată

  const NAV_ADMIN = [
    { id: 'dashboard', label: 'Panou', icon: '📊' },
    { id: 'analysis', label: 'Analiză avere', icon: '🔎' },
    { id: 'investments', label: 'Investiții', icon: '📈' },
    { id: 'grandparents', label: 'Conturi Bunici', icon: '🏦' },
    { id: 'realestate', label: 'Imobiliare', icon: '🏡' },
    { id: 'children', label: 'Copii', icon: '🐷' },
    { id: 'vehicles', label: 'Auto', icon: '🚗' },
    { id: 'guide', label: 'Ghid Urgență', icon: '🆘' },
    { id: 'members', label: 'Membri', icon: '👪' },
    { id: 'settings', label: 'Setări', icon: '⚙️' }
  ];
  const NAV_VIEWER = [
    { id: 'dashboard', label: 'Partea mea', icon: '📊' },
    { id: 'analysis', label: 'Analiză', icon: '🔎' },
    { id: 'myassets', label: 'Activele mele', icon: '📁' }
  ];

  const INVESTMENT_TYPES = ['Acțiuni BVB', 'Acțiuni internaționale', 'ETF-uri (ex. VWCE)', 'Titluri de stat (Fidelis / Tezaur)', 'Obligațiuni corporative',
    'Fonduri mutuale', 'Pensie privată Pilon II', 'Pensie facultativă Pilon III', 'Asigurare de viață cu investiții', 'Aur / metale prețioase',
    'Crypto (Bitcoin, Ethereum etc.)', 'Depozit la termen'];
  const BANK_ACCOUNT_TYPES = ['Depozit la termen (1 lună)', 'Depozit la termen (3 luni)', 'Depozit la termen (6 luni)', 'Depozit la termen (12 luni)',
    'Cont de economii', 'Cont curent', 'Titluri de stat (Tezaur)'];
  const CHILD_ACCOUNT_TYPES = ['Cont Centenar Trezorerie', 'Cont de economii', 'Depozit la termen', 'Cont curent junior'];
  // Sugestiile implicite + valorile deja folosite în date (ca să nu dispară nimic din ce ai scris înainte).
  const usedValues = (pairs) => pairs.flatMap(([col, key]) => (D()[col] || []).map((x) => (x[key] || '').trim())).filter(Boolean);
  const uniq = (arr) => [...new Map(arr.map((v) => [v.toLowerCase(), v])).values()];
  const COMBO_LISTS = {
    'dl-platforms': () => uniq([...PLATFORMS, ...usedValues([['investment_accounts', 'platform'], ['grandparents_accounts', 'bank_name']])]),
    'dl-inv-types': () => uniq([...INVESTMENT_TYPES, ...usedValues([['investment_accounts', 'account_type']])]),
    'dl-bank-types': () => uniq([...BANK_ACCOUNT_TYPES, ...usedValues([['grandparents_accounts', 'account_type']])]),
    'dl-child-types': () => uniq([...CHILD_ACCOUNT_TYPES, ...usedValues([['children_savings', 'account_type']])])
  };
  const PLATFORMS = ['Tradeville', 'Interactive Brokers (IBKR)', 'CEC Bank', 'Banca Transilvania (BT)', 'BCR', 'BRD', 'ING Bank', 'Raiffeisen Bank', 'Titluri Tezaur', 'Fidelis', 'XTB', 'Trading 212', 'Revolut', 'Robinhood', 'Binance', 'Trezoreria Statului', 'NN Pensii', 'Allianz-Țiriac Pensii Private', 'Metropolitan Life Pensii', 'BCR Pensii', 'BRD Pensii', 'BT Pensii Private'];

  /* ======================================================================
     DATE DEMO (schema din specificație + câmpuri opționale compatibile)
     ====================================================================== */
  const DEMO_DATA = {
    metadata: { version: '1.2.0', last_updated: '2000-01-01T00:00:00Z', base_currency: 'RON', exchange_rates: { EUR: 4.97, USD: 4.65 } },
    family_members: [
      { id: 'mem_1', name: 'Personal', role: 'admin' },
      { id: 'mem_2', name: 'Soție', role: 'admin' },
      { id: 'mem_3', name: 'Andrei (Copil)', role: 'viewer_restricted' },
      { id: 'mem_4', name: 'Bunica Maria', role: 'viewer' },
      { id: 'mem_5', name: 'Bunicul Ion', role: 'viewer' }
    ],
    investment_accounts: [
      { id: 'inv_01', platform: 'Tradeville', account_type: 'Acțiuni BVB & Titluri Fidelis', total_value: 125000, currency: 'RON', notes: 'Cont principal de investiții pe bursă',
        splits: [{ member_id: 'mem_1', percentage: 50 }, { member_id: 'mem_2', percentage: 50 }] },
      { id: 'inv_02', platform: 'Interactive Brokers (IBKR)', account_type: 'ETF-uri Internaționale (VWCE)', total_value: 15000, currency: 'EUR', notes: 'Alocare mixtă familie',
        splits: [{ member_id: 'mem_2', percentage: 40 }, { member_id: 'mem_4', percentage: 60 }] }
    ],
    grandparents_accounts: [
      { id: 'bank_gp_01', bank_name: 'CEC Bank', account_type: 'Depozit la termen (12 luni)', owner_id: 'mem_5', iban_or_account: 'RO44 CECE 4000 ...', principal_amount: 40000, interest_rate: 5.75, maturity_date: '2027-03-15', currency: 'RON',
        splits: [{ member_id: 'mem_5', percentage: 80 }, { member_id: 'mem_2', percentage: 20 }] }
    ],
    real_estate: [
      { id: 're_01', title: 'Teren Agricol Extravilan - Jud. Cluj', owner_id: 'mem_4', surface_area: '2.5 ha', share_percentage: 100, estimated_value: 75000, currency: 'RON',
        legal_status: 'Certificat de moștenitor eliberat (Titlu nr. 12345)', notes: 'Contract de arendă activ până în 2028. Actele originale sunt în dosarul din birou.' }
    ],
    children_savings: [
      { id: 'child_acc_01', child_id: 'mem_3', account_type: 'Cont Centenar Trezorerie', iban: 'RO99 TREZ 7000 ...', current_balance: 8400, currency: 'RON',
        monthly_contribution: { target_amount: 200, due_day: 1, is_paid_this_month: false, last_payment_date: '2026-10-01' },
        government_bonus_tracker: { yearly_target: 1200, yearly_deposited: 1000, bonus_eligible: true, bonus_amount: 600 },
        tracker_year: 2026,
        balance_history: [
          { date: '2026-06-01', balance: 7600 }, { date: '2026-07-01', balance: 7800 }, { date: '2026-08-01', balance: 8000 },
          { date: '2026-09-01', balance: 8200 }, { date: '2026-10-01', balance: 8400 }
        ] }
    ],
    vehicles: [
      { id: 'veh_01', name: 'Dacia Duster 2022', plate_number: 'CJ 10 ABC', owner_id: 'mem_1', estimated_market_value: 70000, currency: 'RON',
        documents: {
          rca: { insurer: 'Groupama', expiration_date: '2027-04-15', cost: 1200 },
          rovinieta: { expiration_date: '2027-01-20', cost: 140 },
          itp: { expiration_date: '2027-08-10' },
          casco: { insurer: 'Allianz-Țiriac', expiration_date: '2027-04-15', cost: 2800 }
        } }
    ],
    emergency_guide: {
      instructions: 'În caz de urgență, toate conturile principale sunt la Tradeville și CEC Bank. Dosarul fizic cu titlurile de proprietate se află în dulapul din birou.',
      trusted_contacts: [{ name: 'Notar Public Popescu', phone: '0722 000 000', role: 'Succesiuni & Acte' }]
    }
  };

  const emptyData = () => ({
    metadata: { version: '1.2.0', last_updated: new Date().toISOString(), base_currency: 'RON', exchange_rates: { EUR: 4.97, USD: 4.65 } },
    family_members: [{ id: uid('mem'), name: 'Administrator', role: 'admin' }],
    investment_accounts: [], grandparents_accounts: [], real_estate: [], children_savings: [], vehicles: [],
    emergency_guide: { instructions: '', trusted_contacts: [] }
  });

  /* ======================================================================
     UTILITARE
     ====================================================================== */
  function uid(prefix) { return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`; }
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  function setPath(o, p, v) {
    const ks = p.split('.');
    let c = o;
    ks.slice(0, -1).forEach((k) => { if (typeof c[k] !== 'object' || c[k] === null) c[k] = {}; c = c[k]; });
    c[ks[ks.length - 1]] = v;
  }
  const sum = (arr) => arr.reduce((s, x) => s + x, 0);
  const $ = (sel, root = document) => root.querySelector(sel);

  function loadJSON(key, def) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { toast('Nu s-a putut salva local (stocare plină sau blocată).', 'error'); return false; }
  }
  // Salvează datele local: criptate (anvelopă vault) dacă parola familiei e activă, altfel JSON simplu.
  let saveChain = Promise.resolve();
  function saveData(d) {
    if (!FWVault.enabled()) { saveJSON(LS.DATA, d); return saveChain; }
    const snapshot = JSON.stringify(d); // instantaneu acum; criptarea e asincronă
    saveChain = saveChain
      .then(async () => { if (FWVault.enabled()) saveJSON(LS.DATA, await FWVault.encrypt(JSON.parse(snapshot))); })
      .catch(() => toast('Nu s-au putut cripta datele local.', 'error'));
    return saveChain;
  }
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  /* ---------- Parole per membru (PBKDF2-SHA256 + salt aleator) ----------
     Hash-ul e salvat în family_members[].auth și se sincronizează în Drive,
     deci parola e aceeași pe toate dispozitivele. Blochează interfața; nu criptează datele. */
  const PBKDF2_ITER = 150000;
  const MIN_PASSWORD = 4;
  const cryptoOk = () => !!(window.crypto && crypto.subtle && crypto.getRandomValues);
  const toHex = (buf) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  const fromHex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));

  async function derive(password, salt, iter) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
    return toHex(bits);
  }
  async function makeAuth(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { algo: 'PBKDF2-SHA256', iter: PBKDF2_ITER, salt: toHex(salt), hash: await derive(password, salt, PBKDF2_ITER) };
  }
  async function checkAuth(password, auth) {
    if (!auth) return true;
    if (!cryptoOk()) return false;
    return (await derive(password, fromHex(auth.salt), auth.iter || PBKDF2_ITER)) === auth.hash;
  }
  let failedAttempts = 0;

  /* ======================================================================
     STATE
     ====================================================================== */
  const settings = Object.assign(
    { clientId: '', driveConnected: false, lastSync: null },
    loadJSON(LS.SETTINGS, {})
  );
  delete settings.adminPinHash; // înlocuit de parolele per membru
  const saveSettings = () => saveJSON(LS.SETTINGS, settings);
  const clientId = () => settings.clientId || CONFIG.GOOGLE_CLIENT_ID;

  const state = {
    data: null,
    profileId: null,
    view: 'dashboard',
    sync: { status: 'off', message: '' },
    modal: null,
    installPrompt: null
  };

  const D = () => state.data;
  const M = () => state.data.metadata;
  const baseCur = () => Calc.baseCurrency(M());
  const money = (v, cur) => Calc.formatMoney(v, cur || baseCur());
  const member = (id) => D().family_members.find((m) => m.id === id);
  const memberName = (id) => (member(id) ? member(id).name : 'Membru șters');
  const memberColor = (id) => { const i = D().family_members.findIndex((m) => m.id === id); return i < 0 || i >= MEMBER_COLORS.length ? Calc.OTHER_COLOR : MEMBER_COLORS[i]; };
  const currentMember = () => (state.profileId ? member(state.profileId) : null);
  const isAdmin = () => { const m = currentMember(); return !!m && m.role === 'admin'; };

  function normalizeData(data) {
    const d = data && typeof data === 'object' ? data : emptyData();
    d.metadata = Object.assign({ version: '1.2.0', base_currency: 'RON', exchange_rates: {} }, d.metadata || {});
    if (!d.metadata.last_updated) d.metadata.last_updated = new Date().toISOString();
    ['family_members', 'investment_accounts', 'grandparents_accounts', 'real_estate', 'children_savings', 'vehicles']
      .forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
    d.emergency_guide = Object.assign({ instructions: '', trusted_contacts: [] }, d.emergency_guide || {});
    if (!Array.isArray(d.emergency_guide.trusted_contacts)) d.emergency_guide.trusted_contacts = [];
    d.children_savings.forEach((a) => {
      a.monthly_contribution = Object.assign({ target_amount: 0, due_day: 1, is_paid_this_month: false, last_payment_date: null }, a.monthly_contribution || {});
      a.government_bonus_tracker = Object.assign({ yearly_target: 1200, yearly_deposited: 0, bonus_eligible: false }, a.government_bonus_tracker || {});
      if (!Array.isArray(a.balance_history)) a.balance_history = [];
    });
    d.vehicles.forEach((v) => { v.documents = v.documents || {}; });
    applyRollovers(d);
    return d;
  }

  /** Resetează „plătit luna aceasta” la lună nouă și contorul anual la an nou. Determinist ⇒ nu modifică last_updated. */
  function applyRollovers(d, today = new Date()) {
    let changed = false;
    const ym = Calc.monthKey(today);
    const year = today.getFullYear();
    d.children_savings.forEach((a) => {
      const mc = a.monthly_contribution;
      if (mc.is_paid_this_month && (!mc.last_payment_date || mc.last_payment_date.slice(0, 7) !== ym)) { mc.is_paid_this_month = false; changed = true; }
      if (a.tracker_year == null) { a.tracker_year = year; changed = true; }
      else if (a.tracker_year !== year) {
        a.tracker_year = year;
        a.government_bonus_tracker.yearly_deposited = 0;
        a.government_bonus_tracker.bonus_eligible = false;
        changed = true;
      }
    });
    return changed;
  }

  function demoData() {
    const demo = normalizeData(clone(DEMO_DATA));
    setTimeout(() => toast('Au fost încărcate date demo. Le poți șterge din Setări → Date.', 'info', 6000), 600);
    return demo;
  }

  /** Salvare locală + auto-save Drive. */
  function persist() {
    M().last_updated = new Date().toISOString();
    saveData(D());
    scheduleDrivePush();
  }

  function commit(mutator, msg) {
    mutator(D());
    persist();
    render();
    if (msg) toast(msg, 'success');
  }

  function pushHistory(acc) {
    const today = Calc.todayISO();
    acc.balance_history = acc.balance_history || [];
    const last = acc.balance_history[acc.balance_history.length - 1];
    if (last && last.date === today) last.balance = Calc.num(acc.current_balance);
    else acc.balance_history.push({ date: today, balance: Calc.num(acc.current_balance) });
    if (acc.balance_history.length > 240) acc.balance_history = acc.balance_history.slice(-240);
  }

  /* ======================================================================
     SINCRONIZARE GOOGLE DRIVE
     ====================================================================== */
  let pushTimer = null;
  let pendingPush = false;

  function setSync(status, message = '') {
    state.sync = { status, message };
    const el = $('#sync-badge');
    if (el) el.innerHTML = syncBadgeHtml();
    const box = $('#drive-status');
    if (box) box.innerHTML = driveStatusHtml();
  }

  function scheduleDrivePush() {
    if (!settings.driveConnected) return;
    pendingPush = true;
    clearTimeout(pushTimer);
    if (!navigator.onLine) { setSync('offline'); return; }
    if (!DriveSync.hasValidToken()) { setSync('auth', 'Modificări nesincronizate'); return; }
    setSync('pending');
    pushTimer = setTimeout(pushNow, 1500);
  }

  async function pushNow() {
    if (!pendingPush) return;
    if (!navigator.onLine) { setSync('offline'); return; }
    if (!DriveSync.hasValidToken()) { setSync('auth', 'Modificări nesincronizate'); return; }
    setSync('syncing');
    try {
      await DriveSync.push(D(), { allowPlain: !!settings.allowPlainPush });
      pendingPush = false;
      if (settings.allowPlainPush) settings.allowPlainPush = false;
      settings.lastSync = new Date().toISOString(); saveSettings();
      setSync('synced');
    } catch (e) {
      if (e.code === 'NEED_PASSWORD') { setSync('auth', 'Datele din Drive sunt criptate'); askVaultPassword(e.envelope, pushNow); return; }
      setSync(e.status === 401 ? 'auth' : 'error', e.message);
    }
  }

  async function connectDrive(opts = {}) {
    if (!clientId()) {
      toast('Introdu întâi Google OAuth Client ID.', 'error');
      if (isAdmin()) { state.view = 'settings'; render(); }
      return;
    }
    if (!navigator.onLine) { toast('Ești offline. Conectarea la Drive necesită internet.', 'error'); return; }
    setSync('syncing', 'Autentificare…');
    try {
      const prevEmail = settings.driveEmail || null;
      // Fără cont ales anterior (sau la „Schimbă contul”) → lista de conturi Google; altfel contul ținut minte.
      await DriveSync.connect(clientId(), { selectAccount: !!opts.selectAccount || !prevEmail, hint: opts.selectAccount ? null : prevEmail });
      let email = null;
      try { email = await DriveSync.accountEmail(); } catch (e) { /* nu e esențial */ }
      const switched = !prevEmail || (!!email && email !== prevEmail);
      if (email) settings.driveEmail = email;
      settings.driveConnected = true;
      if (switched) settings.lastSync = null;
      saveSettings();
      // Cont nou pe acest dispozitiv: preia datele din Drive-ul contului, nu le suprascrie cu cele locale.
      await runSync({ preferRemote: switched });
    } catch (e) {
      setSync(settings.driveConnected ? 'auth' : 'off', e.message);
      toast(e.message, 'error');
    }
  }

  async function runSync(opts = {}) {
    if (!DriveSync.hasValidToken()) return connectDrive();
    if (settings.allowPlainPush) { pendingPush = true; return pushNow(); } // criptarea tocmai a fost dezactivată
    setSync('syncing');
    try {
      const res = await DriveSync.sync(D(), { preferRemote: !!opts.preferRemote });
      if (res.action === 'pulled') {
        state.data = normalizeData(res.data);
        saveData(state.data);
        if (!currentMember()) state.profileId = null;
        toast(opts.preferRemote && settings.driveEmail ? `Date preluate din Google Drive (${settings.driveEmail}).` : 'Date actualizate din Google Drive.', 'success');
      } else if (res.action === 'pushed') {
        toast('Datele locale au fost salvate în Google Drive.', 'success');
      }
      pendingPush = false;
      settings.lastSync = new Date().toISOString(); saveSettings();
      setSync('synced');
      render();
    } catch (e) {
      if (e.code === 'NEED_PASSWORD') { setSync('auth', 'Datele din Drive sunt criptate'); askVaultPassword(e.envelope, () => runSync(opts)); return; }
      setSync(e.status === 401 ? 'auth' : 'error', e.message);
      toast(e.message, 'error');
    }
  }

  /* ---------- Parola familiei (criptare) ---------- */
  // Cerută când datele din Drive sunt criptate, iar acest dispozitiv încă nu are parola (sau a fost schimbată).
  function askVaultPassword(env, after) {
    if (state.modal) return;
    openModal({
      title: '🔒 Parola familiei',
      body: `<p class="text-sm text-slate-600 mb-3">Datele din Google Drive sunt criptate. Introdu parola familiei ca să le folosești pe acest dispozitiv.</p>
        <input type="text" name="username" value="familie" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true">
        <input name="vaultpw" type="password" autocomplete="current-password" class="input" aria-label="Parola familiei" required>`,
      submitLabel: 'Deblochează',
      onSubmit: async (form) => {
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true;
        const data = await FWVault.unlock(form.vaultpw.value, env);
        if (!data) {
          failedAttempts++; await delay(Math.min(5000, 400 * failedAttempts));
          btn.disabled = false; showFormErrors(['Parolă greșită.']); form.vaultpw.value = ''; form.vaultpw.focus();
          return false;
        }
        failedAttempts = 0;
        await saveData(D());
        toast('Parola familiei a fost acceptată. Datele sunt criptate și pe acest dispozitiv.', 'success');
        if (after) setTimeout(after, 0);
        return true;
      }
    });
  }

  // Parola familiei: minim 8 caractere, cel puțin o literă și o cifră.
  const VAULT_MIN = 8;
  const vaultPasswordErrors = (pw) => {
    const e = [];
    if (pw.length < VAULT_MIN) e.push(`Parola trebuie să aibă minim ${VAULT_MIN} caractere.`);
    if (!/\p{L}/u.test(pw) || !/\d/.test(pw)) e.push('Parola trebuie să conțină litere și cifre.');
    return e;
  };

  function vaultEnableForm() {
    if (!FWVault.supported()) { toast('Browserul nu suportă criptarea (este nevoie de HTTPS).', 'error'); return; }
    openModal({
      title: '🔐 Activează criptarea',
      body: `<div class="space-y-3 text-sm">
        <p class="text-slate-600">Parola se cere la deschiderea aplicației pe fiecare dispozitiv (o dată pe sesiune). Folosiți aceeași parolă în toată familia.</p>
        <input type="text" name="username" value="familie" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true">
        <label class="field"><span class="field-label">Parola familiei *</span><input name="pw1" type="password" autocomplete="new-password" minlength="8" class="input" required>
          <span class="field-hint">Minim 8 caractere, cu litere și cifre. Evită nume și ani din familie.</span></label>
        <label class="field"><span class="field-label">Confirmă parola *</span><input name="pw2" type="password" autocomplete="new-password" class="input" required></label>
        <label class="flex items-start gap-2 alert-red"><input name="ack" type="checkbox" class="w-4 h-4 mt-0.5 accent-rose-600">
          <span>Am notat parola într-un loc sigur. Înțeleg că <strong>fără ea datele nu mai pot fi recuperate</strong>.</span></label>
      </div>`,
      submitLabel: 'Activează criptarea',
      onSubmit: async (form) => {
        const errors = [];
        errors.push(...vaultPasswordErrors(form.pw1.value));
        if (form.pw1.value !== form.pw2.value) errors.push('Parolele nu coincid.');
        if (!form.ack.checked) errors.push('Confirmă că ai notat parola.');
        if (errors.length) { showFormErrors(errors); return false; }
        const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Se criptează…';
        await FWVault.setup(form.pw1.value);
        persist();
        toast(settings.driveConnected ? 'Criptare activată. Datele se criptează și în Google Drive.' : 'Criptare activată.', 'success', 5000);
        setTimeout(render, 0);
        return true;
      }
    });
  }

  function vaultChangeForm() {
    openModal({
      title: 'Schimbă parola familiei',
      body: `<div class="space-y-3 text-sm">
        <input type="text" name="username" value="familie" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true">
        <label class="field"><span class="field-label">Parola actuală *</span><input name="cur" type="password" autocomplete="current-password" class="input" required></label>
        <label class="field"><span class="field-label">Parola nouă *</span><input name="pw1" type="password" autocomplete="new-password" minlength="8" class="input" required><span class="field-hint">Minim 8 caractere, cu litere și cifre.</span></label>
        <label class="field"><span class="field-label">Confirmă parola nouă *</span><input name="pw2" type="password" autocomplete="new-password" class="input" required></label>
        <p class="text-slate-500">Pe celelalte dispozitive se va cere parola nouă la următoarea sincronizare. Backupurile criptate vechi rămân cu parola veche.</p>
      </div>`,
      submitLabel: 'Schimbă parola',
      onSubmit: async (form) => {
        const errors = [];
        errors.push(...vaultPasswordErrors(form.pw1.value));
        if (form.pw1.value !== form.pw2.value) errors.push('Parolele noi nu coincid.');
        if (errors.length) { showFormErrors(errors); return false; }
        const btn = form.querySelector('[type=submit]'); btn.disabled = true;
        if (!(await FWVault.verifyPassword(form.cur.value))) { btn.disabled = false; showFormErrors(['Parola actuală este greșită.']); return false; }
        await FWVault.setup(form.pw1.value);
        persist();
        toast('Parola familiei a fost schimbată.', 'success');
        return true;
      }
    });
  }

  function vaultDisableForm() {
    openModal({
      title: 'Dezactivează criptarea',
      danger: true,
      body: `<div class="space-y-3 text-sm">
        <p class="alert-red">Datele vor fi salvate <strong>necriptat</strong> pe acest dispozitiv și în Google Drive.</p>
        <input type="text" name="username" value="familie" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true">
        <label class="field"><span class="field-label">Parola familiei *</span><input name="cur" type="password" autocomplete="current-password" class="input" required></label>
      </div>`,
      submitLabel: 'Dezactivează',
      onSubmit: async (form) => {
        const btn = form.querySelector('[type=submit]'); btn.disabled = true;
        if (!(await FWVault.verifyPassword(form.cur.value))) { btn.disabled = false; showFormErrors(['Parolă greșită.']); return false; }
        await saveChain;
        FWVault.lock();
        if (settings.driveConnected) { settings.allowPlainPush = true; saveSettings(); }
        persist();
        toast('Criptarea a fost dezactivată.', 'success');
        setTimeout(render, 0);
        return true;
      }
    });
  }

  async function lockNow() {
    await saveChain;
    FWVault.lock();
    ssSet(SS_UNLOCK, null);
    location.reload();
  }

  function renderLockScreen(error) {
    return `<div class="min-h-screen flex items-center justify-center p-4">
      <form data-form="unlock" class="card w-full max-w-sm text-center p-6">
        <div class="text-5xl">🔒</div>
        <h1 class="text-xl font-bold mt-3">Patrimoniu Familial</h1>
        <p class="text-sm text-slate-500 mt-1">Datele sunt criptate. Introdu parola familiei.</p>
        <input type="text" name="username" value="familie" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true">
        <input name="password" type="password" autocomplete="current-password" class="input mt-4 text-center" aria-label="Parola familiei" required>
        <p id="unlock-error" class="text-sm text-rose-600 mt-2 min-h-[1.25rem]">${error ? esc(error) : ''}</p>
        <button class="btn-primary w-full mt-2">Deblochează</button>
      </form></div>`;
  }

  function showLockScreen(env, error) {
    state.lockedEnvelope = env;
    $('#app').innerHTML = renderLockScreen(error);
    setTimeout(() => { const i = $('[data-form="unlock"] [name="password"]'); if (i) i.focus(); }, 30);
  }

  function disconnectDrive() {
    DriveSync.disconnect();
    settings.driveConnected = false; settings.lastSync = null; settings.driveEmail = null; saveSettings();
    pendingPush = false;
    setSync('off');
    render();
    toast('Google Drive a fost deconectat. Datele rămân pe acest dispozitiv.', 'info');
  }

  function syncBadgeHtml() {
    const s = state.sync.status;
    const map = {
      off:     ['bg-slate-100 text-slate-600', '💾', 'Doar local', 'nav-settings'],
      auth:    ['bg-amber-100 text-amber-800', '🔑', 'Conectează Drive', 'connectDrive'],
      pending: ['bg-amber-100 text-amber-800', '⏳', 'Se salvează…', ''],
      syncing: ['bg-sky-100 text-sky-800', '<span class="spin">↻</span>', 'Sincronizare…', ''],
      synced:  ['bg-emerald-100 text-emerald-800', '✓', 'Sincronizat', 'syncNow'],
      offline: ['bg-slate-200 text-slate-700', '📴', 'Offline', ''],
      error:   ['bg-rose-100 text-rose-800', '⚠', 'Eroare sync', 'syncNow']
    };
    const [cls, icon, label, action] = map[s] || map.off;
    const title = esc(state.sync.message || label);
    if (s === 'off' && !isAdmin()) return '';
    return `<button ${action ? `data-action="${action}"` : 'disabled'} title="${title}" class="sync-badge ${cls}">${icon}<span class="hidden sm:inline">${label}</span></button>`;
  }

  /* ======================================================================
     TOAST & MODAL
     ====================================================================== */
  function toast(msg, type = 'info', ms = 3500) {
    const root = $('#toast-root');
    if (!root) return;
    const colors = { info: 'bg-slate-800', success: 'bg-emerald-600', error: 'bg-rose-600' };
    const el = document.createElement('div');
    el.className = `toast ${colors[type] || colors.info}`;
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => { el.classList.add('toast-out'); setTimeout(() => el.remove(), 300); }, ms);
  }

  function openModal({ title, body, submitLabel = 'Salvează', onSubmit, danger = false, wide = false, noFooter = false }) {
    state.modal = { onSubmit };
    $('#modal-root').innerHTML = `
      <div class="modal-backdrop" data-action="closeModal"></div>
      <div class="modal-wrap" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <form class="modal ${wide ? 'max-w-2xl' : 'max-w-md'}" data-modal-form novalidate>
          <div class="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 class="font-semibold text-lg">${esc(title)}</h2>
            <button type="button" data-action="closeModal" class="btn-ghost btn-sm" aria-label="Închide">✕</button>
          </div>
          <div class="px-5 py-4 overflow-y-auto">${body}<div id="form-errors" class="mt-3"></div></div>
          ${noFooter ? '' : `<div class="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
            <button type="button" data-action="closeModal" class="btn-secondary">Anulează</button>
            <button type="submit" class="${danger ? 'btn-danger' : 'btn-primary'}">${esc(submitLabel)}</button>
          </div>`}
        </form>
      </div>`;
    document.body.classList.add('overflow-hidden');
    const first = $('#modal-root input:not([type=hidden]), #modal-root select, #modal-root textarea');
    if (first) setTimeout(() => first.focus(), 30);
  }

  function closeModal() {
    state.modal = null;
    $('#modal-root').innerHTML = '';
    document.body.classList.remove('overflow-hidden');
  }

  function showFormErrors(errors) {
    const box = $('#form-errors');
    if (box) box.innerHTML = errors.length ? `<div class="alert-red text-sm"><ul class="list-disc pl-5">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : '';
  }

  function confirmDialog(title, message, label = 'Șterge') {
    return new Promise((resolve) => {
      openModal({ title, body: `<p class="text-slate-600">${esc(message)}</p>`, submitLabel: label, danger: true, onSubmit: () => { resolve(true); return true; } });
      state.modal.onCancel = () => resolve(false);
    });
  }

  /* ======================================================================
     FORMULARE GENERICE (schema → formular)
     ====================================================================== */
  const docFields = (k, label, withInsurer, withCost) => [
    { type: 'section', label },
    ...(withInsurer ? [{ k: `documents.${k}.insurer`, label: 'Asigurator', type: 'text' }] : []),
    { k: `documents.${k}.expiration_date`, label: 'Data expirării', type: 'date' },
    ...(withCost ? [{ k: `documents.${k}.cost`, label: 'Cost (RON)', type: 'number', min: 0 }] : [])
  ];

  const SCHEMAS = {
    investment_accounts: {
      singular: 'cont de investiții', prefix: 'inv', splits: true,
      defaults: () => ({ platform: '', account_type: '', total_value: 0, currency: 'RON', notes: '', splits: defaultSplits() }),
      fields: [
        { k: 'platform', label: 'Platformă / Instituție', type: 'text', req: true, list: 'dl-platforms' },
        { k: 'account_type', label: 'Tip investiție / Instrumente', type: 'text', list: 'dl-inv-types', placeholder: 'Alege din listă sau scrie' },
        { k: 'total_value', label: 'Valoare totală', type: 'number', req: true, min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        { k: 'interest_rate', label: 'Dobândă anuală (%)', type: 'number', min: 0, max: 100, showIf: 'deposit' },
        { k: 'start_date', label: 'Data constituirii', type: 'date', showIf: 'deposit' },
        { k: 'maturity_date', label: 'Data scadenței', type: 'date', showIf: 'deposit' },
        { k: 'tax_rate', label: 'Impozit pe dobândă (%)', type: 'number', min: 0, max: 100, hint: 'Implicit 10% (reținut de bancă)', showIf: 'deposit' },
        { k: 'maturity_value', label: 'Valoare la scadență (din contract)', type: 'number', min: 0, hint: 'Opțional — gol = calcul automat', showIf: 'deposit' },
        { type: 'preview', id: 'deposit-preview', showIf: 'deposit' },
        { k: 'notes', label: 'Note', type: 'textarea', wide: true }
      ]
    },
    grandparents_accounts: {
      singular: 'cont bancar', prefix: 'bank', splits: true,
      defaults: () => ({ bank_name: '', account_type: '', owner_id: firstByRole('viewer'), iban_or_account: '', principal_amount: 0, interest_rate: 0, start_date: null, maturity_date: null, tax_rate: 10, maturity_value: null, currency: 'RON', splits: [] }),
      fields: [
        { k: 'bank_name', label: 'Bancă / Instituție', type: 'text', req: true, list: 'dl-platforms' },
        { k: 'account_type', label: 'Tip cont', type: 'text', list: 'dl-bank-types', placeholder: 'Alege din listă sau scrie' },
        { k: 'owner_id', label: 'Titular cont', type: 'member', req: true },
        { k: 'iban_or_account', label: 'IBAN / Nr. cont', type: 'text' },
        { k: 'principal_amount', label: 'Sumă (principal)', type: 'number', req: true, min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        { k: 'interest_rate', label: 'Dobândă anuală (%)', type: 'number', min: 0, max: 100 },
        { k: 'start_date', label: 'Data constituirii', type: 'date', hint: 'Pentru calculul exact al dobânzii' },
        { k: 'maturity_date', label: 'Data scadenței', type: 'date' },
        { k: 'tax_rate', label: 'Impozit pe dobândă (%)', type: 'number', min: 0, max: 100, hint: 'Implicit 10% (reținut de bancă)' },
        { k: 'maturity_value', label: 'Valoare la scadență (din contract)', type: 'number', min: 0, hint: 'Opțional — gol = calcul automat' },
        { type: 'preview', id: 'deposit-preview' }
      ]
    },
    real_estate: {
      singular: 'proprietate', prefix: 're',
      defaults: () => ({ title: '', owner_id: firstByRole('admin'), surface_area: '', share_percentage: 100, estimated_value: 0, currency: 'RON', legal_status: '', notes: '' }),
      fields: [
        { k: 'title', label: 'Denumire', type: 'text', req: true, wide: true, placeholder: 'Ex: Apartament 2 camere - Cluj-Napoca' },
        { k: 'owner_id', label: 'Proprietar', type: 'member', req: true },
        { k: 'surface_area', label: 'Suprafață', type: 'text', placeholder: 'Ex: 2.5 ha / 54 mp' },
        { k: 'estimated_value', label: 'Valoare estimată (100%)', type: 'number', req: true, min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        { k: 'share_percentage', label: 'Cotă deținută de familie (%)', type: 'number', req: true, min: 0, max: 100 },
        { k: 'legal_status', label: 'Status cadastral / succesoral', type: 'textarea', wide: true },
        { k: 'notes', label: 'Note & locația fizică a actelor', type: 'textarea', wide: true }
      ]
    },
    children_savings: {
      singular: 'cont de economii', prefix: 'child_acc',
      defaults: () => ({
        child_id: firstByRole('viewer_restricted'), account_type: 'Cont Centenar Trezorerie', iban: '', current_balance: 0, currency: 'RON',
        monthly_contribution: { target_amount: 200, due_day: 1, is_paid_this_month: false, last_payment_date: null },
        government_bonus_tracker: { yearly_target: 1200, yearly_deposited: 0, bonus_eligible: false, bonus_amount: 600 },
        tracker_year: new Date().getFullYear(), balance_history: []
      }),
      fields: [
        { k: 'child_id', label: 'Copil', type: 'member', req: true, roles: ['viewer_restricted'] },
        { k: 'account_type', label: 'Tip cont', type: 'text', list: 'dl-child-types', placeholder: 'Alege din listă sau scrie' },
        { k: 'iban', label: 'IBAN', type: 'text' },
        { k: 'current_balance', label: 'Sold curent', type: 'number', req: true, min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        { type: 'section', label: 'Contribuție lunară' },
        { k: 'monthly_contribution.target_amount', label: 'Sumă lunară', type: 'number', min: 0 },
        { k: 'monthly_contribution.due_day', label: 'Ziua scadentă (1–28)', type: 'number', min: 1, max: 28, int: true },
        { k: 'monthly_contribution.is_paid_this_month', label: 'Alimentat luna aceasta', type: 'checkbox' },
        { type: 'section', label: 'Prima de stat (doar pentru Cont Centenar)' },
        { k: 'government_bonus_tracker.yearly_target', label: 'Prag anual', type: 'number', min: 0, hint: 'Implicit 1.200 RON' },
        { k: 'government_bonus_tracker.yearly_deposited', label: 'Depus anul acesta', type: 'number', min: 0 },
        { k: 'government_bonus_tracker.bonus_amount', label: 'Valoare primă / an', type: 'number', min: 0, hint: 'Implicit 600 RON' }
      ]
    },
    vehicles: {
      singular: 'vehicul', prefix: 'veh',
      defaults: () => ({ name: '', plate_number: '', owner_id: firstByRole('admin'), estimated_market_value: 0, currency: 'RON', documents: { rca: {}, rovinieta: {}, itp: {}, casco: {} } }),
      fields: [
        { k: 'name', label: 'Model / An', type: 'text', req: true },
        { k: 'plate_number', label: 'Număr înmatriculare', type: 'text' },
        { k: 'owner_id', label: 'Proprietar', type: 'member', req: true },
        { k: 'estimated_market_value', label: 'Valoare de piață estimată', type: 'number', min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        ...docFields('rca', 'RCA', true, true),
        ...docFields('rovinieta', 'Rovinietă', false, true),
        ...docFields('itp', 'ITP', false, true),
        ...docFields('casco', 'CASCO', true, true)
      ]
    },
    family_members: {
      singular: 'membru', prefix: 'mem',
      defaults: () => ({ name: '', role: 'viewer' }),
      fields: [
        { k: 'name', label: 'Nume afișat', type: 'text', req: true, wide: true },
        { k: 'role', label: 'Rol', type: 'select', req: true, wide: true, options: Object.keys(ROLE_LABELS).map((r) => [r, `${ROLE_LABELS[r]} — ${ROLE_HINTS[r]}`]) }
      ]
    }
  };

  function firstByRole(role) {
    const m = D().family_members.find((x) => x.role === role) || D().family_members[0];
    return m ? m.id : null;
  }
  function defaultSplits() {
    const me = currentMember();
    return me ? [{ member_id: me.id, percentage: 100 }] : [];
  }
  function currencies() { return [baseCur(), ...Object.keys(M().exchange_rates || {}).filter((c) => c !== baseCur())]; }

  function fieldHtml(f, item) {
    const hidden = f.showIf === 'deposit' && !Calc.isDeposit(item.account_type);
    const showAttr = f.showIf ? `data-show-if="${f.showIf}"` : '';
    if (f.type === 'preview') return `<div id="${f.id}" class="sm:col-span-2 ${hidden ? 'hidden' : ''}" ${showAttr}>${depositSummaryHtml(item, item.currency)}</div>`;
    if (f.type === 'section') return `<h4 class="sm:col-span-2 mt-2 pt-3 border-t border-slate-100 text-sm font-semibold text-slate-700">${esc(f.label)}</h4>`;
    const v = getPath(item, f.k);
    const id = 'f_' + f.k.replace(/\./g, '_');
    const common = `id="${id}" data-path="${f.k}" ${f.req ? 'required' : ''}`;
    let input;
    switch (f.type) {
      case 'textarea':
        input = `<textarea ${common} rows="3" class="input">${esc(v)}</textarea>`; break;
      case 'number':
        input = `<input ${common} type="number" inputmode="decimal" step="${f.int ? 1 : 'any'}" ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} value="${v == null ? '' : esc(v)}" class="input">`; break;
      case 'date':
        input = `<input ${common} type="date" value="${esc(v || '')}" class="input">`; break;
      case 'checkbox':
        return `<label class="flex items-center gap-2 sm:col-span-2 text-sm"><input ${common} type="checkbox" ${v ? 'checked' : ''} class="w-4 h-4 accent-teal-600"> ${esc(f.label)}</label>`;
      case 'currency': {
        const list = currencies();
        if (v && !list.includes(v)) list.push(v);
        input = `<select ${common} class="input">${list.map((c) => `<option ${c === v ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>`; break;
      }
      case 'member': {
        let ms = D().family_members;
        if (f.roles) { const filtered = ms.filter((m) => f.roles.includes(m.role)); if (filtered.length) ms = filtered; }
        input = `<select ${common} class="input">${f.req ? '' : '<option value="">—</option>'}${ms.map((m) => `<option value="${esc(m.id)}" ${m.id === v ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>`; break;
      }
      case 'select':
        input = `<select ${common} class="input">${f.options.map(([val, label]) => `<option value="${esc(val)}" ${val === v ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select>`; break;
      default:
        input = `<input ${common} type="text" value="${esc(v)}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} class="input">`;
        if (f.list) input = `<div class="combo">
          <input ${common} type="text" value="${esc(v)}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} data-combo="${f.list}" autocomplete="off" role="combobox" aria-expanded="false" class="input pr-9">
          <button type="button" class="combo-toggle" data-combo-toggle tabindex="-1" aria-label="Arată opțiunile">▾</button>
          <ul class="combo-menu hidden" role="listbox"></ul></div>`;
    }
    return `<label class="field ${f.wide ? 'sm:col-span-2' : ''} ${hidden ? 'hidden' : ''}" for="${id}" ${showAttr}>
      <span class="field-label">${esc(f.label)}${f.req ? ' <span class="text-rose-500">*</span>' : ''}</span>
      ${input}${f.hint ? `<span class="field-hint">${esc(f.hint)}</span>` : ''}</label>`;
  }

  function depositSummaryHtml(acc, cur) {
    const r = Calc.depositReturn(acc);
    if (!r.principal || !r.rate) return `<p class="text-sm text-slate-500">Completează suma și dobânda ca să vezi cât câștigi la scadență.</p>`;
    const period = r.estimated ? `${Math.round(r.days / 30.4)} luni (estimare)` : `${r.days} zile`;
    return `<div class="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
      <dl class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
        <div class="stat"><dt>Perioadă</dt><dd>${period}</dd></div>
        <div class="stat"><dt>Dobândă brută</dt><dd>${money(r.gross, cur)}</dd></div>
        <div class="stat"><dt>Impozit (${Calc.num(r.taxPct)}%)</dt><dd>−${money(r.tax, cur)}</dd></div>
        <div class="stat"><dt>Dobândă netă</dt><dd class="text-emerald-700 font-semibold">+${money(r.net, cur)}</dd></div>
        <div class="stat col-span-2"><dt>Valoare la scadență${r.manual ? ' (din contract)' : ''}</dt><dd class="text-lg font-bold">${money(r.value, cur)}</dd></div>
      </dl></div>`;
  }

  // Recalculează rezumatul depozitului și afișează/ascunde câmpurile de depozit în formularul deschis.
  function refreshDepositForm() {
    const root = $('#modal-root');
    if (!root || !root.querySelector('[data-path]')) return;
    const val = (k) => { const el = root.querySelector(`[data-path="${k}"]`); return el ? el.value : null; };
    const numOrNull = (k) => { const v = val(k); return v == null || v === '' ? null : parseFloat(v); };
    const acc = {
      account_type: val('account_type'), interest_rate: numOrNull('interest_rate'), start_date: val('start_date') || null,
      maturity_date: val('maturity_date') || null, tax_rate: numOrNull('tax_rate'), maturity_value: numOrNull('maturity_value')
    };
    if (root.querySelector('[data-path="principal_amount"]')) acc.principal_amount = numOrNull('principal_amount');
    else acc.total_value = numOrNull('total_value');
    const dep = Calc.isDeposit(acc.account_type);
    root.querySelectorAll('[data-show-if="deposit"]').forEach((el) => el.classList.toggle('hidden', !dep));
    const box = root.querySelector('#deposit-preview');
    if (box) box.innerHTML = depositSummaryHtml(acc, val('currency') || baseCur());
  }

  function splitRowHtml(s) {
    return `<div class="split-row flex gap-2 items-center">
      <select name="split_member" class="input flex-1">${D().family_members.map((m) => `<option value="${esc(m.id)}" ${m.id === s.member_id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
      <div class="relative w-28"><input name="split_pct" type="number" inputmode="decimal" step="any" min="0" max="100" value="${s.percentage == null ? '' : esc(s.percentage)}" class="input pr-7"><span class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span></div>
      <button type="button" data-action="removeSplitRow" class="btn-ghost btn-sm text-rose-600" aria-label="Elimină">✕</button>
    </div>`;
  }

  function splitsEditorHtml(splits) {
    return `<div class="sm:col-span-2 mt-2 pt-3 border-t border-slate-100">
      <div class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-slate-700">Împărțire pe membri (Account Splitting)</span>
        <span id="split-total" class="badge"></span>
      </div>
      <div id="split-rows" class="space-y-2 mt-2">${splits.map(splitRowHtml).join('')}</div>
      <div class="flex flex-wrap gap-2 mt-2">
        <button type="button" data-action="addSplitRow" class="btn-secondary btn-sm">+ Adaugă membru</button>
        <button type="button" data-action="equalSplit" class="btn-ghost btn-sm">Împarte egal</button>
      </div>
    </div>`;
  }

  function readSplits(root) {
    return [...root.querySelectorAll('.split-row')].map((r) => ({
      member_id: r.querySelector('[name=split_member]').value,
      percentage: parseFloat(r.querySelector('[name=split_pct]').value) || 0
    })).filter((s) => s.member_id);
  }

  function updateSplitTotal() {
    const el = $('#split-total');
    if (!el) return;
    const t = Calc.splitsTotal(readSplits($('#modal-root')));
    const ok = Math.abs(t - 100) < 0.01;
    el.textContent = `Total: ${t}%`;
    el.className = `badge ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`;
  }

  function openForm(collection, id, preset) {
    const schema = SCHEMAS[collection];
    const existing = id ? D()[collection].find((x) => x.id === id) : null;
    if (id && !existing) return;
    const item = existing ? clone(existing) : Object.assign(schema.defaults(), preset || {});
    const body = `
      <div class="grid gap-3 sm:grid-cols-2">
        ${schema.fields.map((f) => fieldHtml(f, item)).join('')}
        ${schema.splits ? splitsEditorHtml(item.splits || []) : ''}
      </div>`;
    openModal({
      title: `${existing ? 'Editează' : 'Adaugă'} ${schema.singular}`,
      body, wide: true,
      onSubmit: (form) => {
        const errors = [];
        schema.fields.filter((f) => f.k).forEach((f) => {
          const el = form.querySelector(`[data-path="${f.k}"]`);
          if (!el) return;
          let v;
          if (f.type === 'checkbox') v = el.checked;
          else if (f.type === 'number') {
            v = el.value === '' ? null : parseFloat(el.value);
            if (v != null && !Number.isFinite(v)) { errors.push(`${f.label}: valoare invalidă.`); v = null; }
            if (v != null && f.min != null && v < f.min) errors.push(`${f.label}: minimum ${f.min}.`);
            if (v != null && f.max != null && v > f.max) errors.push(`${f.label}: maximum ${f.max}.`);
            if (v != null && f.int) v = Math.round(v);
          } else {
            v = el.value.trim();
            if (v === '' && !['text', 'textarea'].includes(f.type)) v = null;
          }
          if (f.req && (v == null || v === '')) errors.push(`${f.label} este obligatoriu.`);
          setPath(item, f.k, v);
        });
        if (schema.splits) {
          item.splits = readSplits(form);
          const req = collection === 'investment_accounts' || item.splits.length > 0;
          if (req) errors.push(...Calc.validateSplits(item.splits));
        }
        if (errors.length) { showFormErrors(errors); return false; }

        if (collection === 'children_savings') {
          const g = item.government_bonus_tracker;
          g.bonus_eligible = Calc.num(g.yearly_deposited) >= (Calc.num(g.yearly_target) || 1200);
          if (!existing || Calc.num(existing.current_balance) !== Calc.num(item.current_balance)) pushHistory(item);
        }
        if (collection === 'family_members' && existing && existing.role === 'admin' && item.role !== 'admin' &&
            D().family_members.filter((m) => m.role === 'admin').length < 2) {
          showFormErrors(['Trebuie să rămână cel puțin un administrator.']); return false;
        }

        commit((d) => {
          if (existing) { const i = d[collection].findIndex((x) => x.id === id); d[collection][i] = item; }
          else { item.id = uid(schema.prefix); d[collection].push(item); }
        }, existing ? 'Modificări salvate.' : 'Adăugat cu succes.');
        return true;
      }
    });
    if (schema.splits) updateSplitTotal();
  }

  function memberRefs(id) {
    const d = D(); let n = 0;
    d.investment_accounts.forEach((a) => { if ((a.splits || []).some((s) => s.member_id === id)) n++; });
    d.grandparents_accounts.forEach((a) => { if (a.owner_id === id || (a.splits || []).some((s) => s.member_id === id)) n++; });
    d.real_estate.forEach((a) => { if (a.owner_id === id) n++; });
    d.children_savings.forEach((a) => { if (a.child_id === id) n++; });
    d.vehicles.forEach((a) => { if (a.owner_id === id) n++; });
    return n;
  }

  async function deleteItem(collection, id) {
    const item = D()[collection].find((x) => x.id === id);
    if (!item) return;
    if (collection === 'family_members') {
      if (id === state.profileId) { toast('Nu poți șterge profilul activ.', 'error'); return; }
      const refs = memberRefs(id);
      if (refs) { toast(`Membrul apare în ${refs} active. Elimină-l mai întâi din acestea.`, 'error', 5000); return; }
      if (item.role === 'admin' && D().family_members.filter((m) => m.role === 'admin').length < 2) { toast('Trebuie să rămână cel puțin un administrator.', 'error'); return; }
    }
    const ok = await confirmDialog('Confirmă ștergerea', `Sigur vrei să ștergi „${itemTitle(collection, item)}”? Acțiunea nu poate fi anulată.`);
    if (!ok) return;
    commit((d) => { d[collection] = d[collection].filter((x) => x.id !== id); }, 'Șters.');
  }

  function itemTitle(c, it) {
    return it.platform || it.bank_name || it.title || it.name || it.account_type || 'element';
  }

  /* ======================================================================
     COMPONENTE UI
     ====================================================================== */
  const avatar = (m, size = 'w-10 h-10 text-base') =>
    `<span class="${size} rounded-full inline-flex items-center justify-center font-semibold text-white shrink-0" style="background:${memberColor(m.id)}">${esc((m.name || '?').trim().charAt(0).toUpperCase())}</span>`;

  function sectionHeader(title, subtitle, collection) {
    return `<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div><h2 class="text-2xl font-bold tracking-tight">${esc(title)}</h2>${subtitle ? `<p class="text-slate-500 mt-1">${subtitle}</p>` : ''}</div>
      ${collection && isAdmin() ? `<button data-action="add" data-collection="${collection}" class="btn-primary">+ Adaugă</button>` : ''}
    </div>`;
  }

  const emptyState = (msg, collection) => `<div class="card text-center py-10">
    <p class="text-slate-500">${esc(msg)}</p>
    ${collection && isAdmin() ? `<button data-action="add" data-collection="${collection}" class="btn-primary mt-4">+ Adaugă primul</button>` : ''}</div>`;

  const cardActions = (collection, id) => isAdmin() ? `<div class="flex gap-1 shrink-0 no-print">
    <button data-action="edit" data-collection="${collection}" data-id="${esc(id)}" class="btn-ghost btn-sm" title="Editează" aria-label="Editează">✎</button>
    <button data-action="delete" data-collection="${collection}" data-id="${esc(id)}" class="btn-ghost btn-sm text-rose-600" title="Șterge" aria-label="Șterge">🗑</button></div>` : '';

  const rateWarning = (cur) => Calc.rateKnown(cur, M()) ? '' : `<span class="badge bg-rose-100 text-rose-800 ml-2">curs ${esc(cur)} lipsă</span>`;

  function valueBlock(amount, cur) {
    const base = Calc.toBase(amount, cur, M());
    return `<div class="text-2xl font-bold tabular-nums">${money(amount, cur)}${rateWarning(cur)}</div>
      ${cur && cur !== baseCur() && Calc.rateKnown(cur, M()) ? `<div class="text-sm text-slate-500 tabular-nums">≈ ${money(base)}</div>` : ''}`;
  }

  function splitsHtml(splits, baseValue) {
    if (!splits || !splits.length) return '';
    const total = Calc.splitsTotal(splits);
    const ok = Math.abs(total - 100) < 0.01;
    return `<div class="mt-4">
      <div class="flex h-2 rounded-full overflow-hidden bg-slate-100">${splits.map((s) => `<div style="width:${Math.max(0, Calc.num(s.percentage))}%;background:${memberColor(s.member_id)}"></div>`).join('')}</div>
      <ul class="mt-2 space-y-1 text-sm">${splits.map((s) => `<li class="flex items-center gap-2">
        <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${memberColor(s.member_id)}"></span>
        <span class="flex-1 truncate">${esc(memberName(s.member_id))}</span>
        <span class="text-slate-500 tabular-nums">${Calc.num(s.percentage)}%</span>
        <span class="font-medium tabular-nums w-28 text-right">${money((baseValue * Calc.num(s.percentage)) / 100)}</span></li>`).join('')}</ul>
      ${ok ? '' : `<p class="mt-2 text-sm text-rose-600">⚠ Suma procentelor este ${total}% (trebuie 100%).</p>`}
    </div>`;
  }

  function progressBar(pct, color = '#0d9488', h = 'h-3') {
    return `<div class="w-full ${h} bg-slate-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow="${Math.round(pct)}" aria-valuemin="0" aria-valuemax="100">
      <div class="${h} rounded-full transition-all" style="width:${Math.min(100, Math.max(0, pct))}%;background:${color}"></div></div>`;
  }

  const LEVEL_CLS = { expired: 'alert-red', red: 'alert-red', yellow: 'alert-yellow' };
  const LEVEL_BADGE = { expired: 'bg-rose-600 text-white', red: 'bg-rose-100 text-rose-800', yellow: 'bg-amber-100 text-amber-800' };

  function lineChart(points, color = '#ec4899') {
    if (!points || !points.length) return '<p class="text-sm text-slate-500">Încă nu există istoric al soldului.</p>';
    const W = 600, H = 240, P = { l: 70, r: 24, t: 16, b: 40 };
    const fmtNum = (v) => new Intl.NumberFormat('ro-RO', { notation: v >= 100000 ? 'compact' : 'standard', maximumFractionDigits: 0 }).format(v);
    const vals = points.map((p) => Calc.num(p.balance));
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { max = max * 1.1 || 1; min = min * 0.9; }
    min = Math.max(0, min - (max - min) * 0.15);
    const iw = W - P.l - P.r, ih = H - P.t - P.b;
    const x = (i) => P.l + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
    const y = (v) => P.t + ih * (1 - (v - min) / (max - min));
    const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(vals[i]).toFixed(1)}`).join(' ');
    const area = `${line} L${x(points.length - 1).toFixed(1)},${H - P.b} L${x(0).toFixed(1)},${H - P.b} Z`;
    const ticks = [0, 0.5, 1].map((t) => min + (max - min) * t);
    const step = Math.ceil(points.length / 4);
    const gid = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="Evoluția soldului">
      <defs><linearGradient id="${gid}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".25"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      ${ticks.map((t) => `<line x1="${P.l}" x2="${W - P.r}" y1="${y(t)}" y2="${y(t)}" stroke="#e2e8f0"/><text x="${P.l - 10}" y="${y(t) + 5}" text-anchor="end" font-size="16" fill="#64748b">${esc(fmtNum(t))}</text>`).join('')}
      <path d="${area}" fill="url(#${gid})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
      ${points.map((p, i) => `<circle cx="${x(i)}" cy="${y(vals[i])}" r="4" fill="#fff" stroke="${color}" stroke-width="2"><title>${esc(Calc.formatDate(p.date))}: ${esc(money(vals[i]))}</title></circle>`).join('')}
      ${points.map((p, i) => {
        const last = i === points.length - 1;
        if (!(i % step === 0 || last) || (!last && points.length - 1 - i < step / 2)) return '';
        const anchor = points.length === 1 ? 'middle' : i === 0 ? 'start' : last ? 'end' : 'middle';
        return `<text x="${x(i)}" y="${H - 12}" text-anchor="${anchor}" font-size="16" fill="#64748b">${esc((Calc.parseDate(p.date) || new Date()).toLocaleDateString('ro-RO', { month: 'short', year: '2-digit' }))}</text>`;
      }).join('')}
    </svg>`;
  }

  /* ======================================================================
     VIEWS
     ====================================================================== */
  function renderProfilePicker() {
    const ms = D().family_members;
    return `<div class="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      <img src="icons/icon.svg" alt="" class="w-16 h-16 mb-4">
      <h1 class="text-3xl font-bold tracking-tight text-center">Patrimoniu Familial</h1>
      <p class="text-slate-500 mt-2 mb-8 text-center">Cine folosește aplicația?</p>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        ${ms.map((m) => `<button data-action="selectProfile" data-id="${esc(m.id)}" class="card card-hover flex flex-col items-center gap-3 py-6">
          ${avatar(m, 'w-16 h-16 text-2xl')}
          <span class="font-semibold text-center">${esc(m.name)}</span>
          <span class="text-xs text-slate-500">${ROLE_LABELS[m.role] || m.role}${m.auth ? ' · 🔒 parolă' : ''}</span>
        </button>`).join('')}
      </div>
      <p class="text-xs text-slate-400 mt-10 text-center max-w-md">Datele sunt stocate local pe acest dispozitiv și, opțional, în folderul privat al aplicației din Google Drive-ul tău.</p>
    </div>`;
  }

  function renderShell(content) {
    const me = currentMember();
    const nav = isAdmin() ? NAV_ADMIN : NAV_VIEWER;
    return `<header class="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 no-print">
      <div class="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
        <img src="icons/icon.svg" class="w-9 h-9" alt="">
        <div class="flex-1 min-w-0">
          <h1 class="font-semibold leading-tight truncate">Patrimoniu Familial</h1>
          <p class="text-xs text-slate-500 truncate">${esc(me.name)} · ${ROLE_LABELS[me.role]}</p>
        </div>
        <div id="sync-badge">${syncBadgeHtml()}</div>
        ${FWVault.enabled() ? '<button data-action="lockNow" class="btn-ghost btn-sm" title="Blochează (cere parola familiei)" aria-label="Blochează">🔒</button>' : ''}
        <button data-action="ownPassword" class="btn-ghost btn-sm" title="${me.auth ? 'Schimbă parola' : 'Setează o parolă'}" aria-label="Parola mea">🔑</button>
        <button data-action="switchProfile" class="btn-secondary btn-sm" title="Schimbă profilul">${avatar(me, 'w-6 h-6 text-xs')}<span class="hidden sm:inline">Schimbă</span></button>
      </div>
      <nav class="max-w-6xl mx-auto px-2 flex gap-1 overflow-x-auto no-scrollbar" aria-label="Module">
        ${nav.map((n) => `<button data-action="nav" data-view="${n.id}" class="tab ${state.view === n.id ? 'tab-active' : ''}" ${state.view === n.id ? 'aria-current="page"' : ''}><span aria-hidden="true">${n.icon}</span> ${n.label}</button>`).join('')}
      </nav>
    </header>
    <main class="max-w-6xl mx-auto px-4 py-6 pb-24">${content}</main>`;
  }

  /* ---------- Dashboard ---------- */
  function alertsHtml(adminView) {
    const today = new Date();
    const me = currentMember();
    let vAlerts = Calc.vehicleAlerts(D(), today);
    let reminders = Calc.childReminders(D(), today);
    let maturities = Calc.maturityAlerts(D(), today);
    if (!adminView) {
      vAlerts = vAlerts.filter((a) => a.vehicle.owner_id === me.id);
      reminders = [];
      maturities = maturities.filter((m) => m.account.owner_id === me.id || (m.account.splits || []).some((s) => s.member_id === me.id));
    }
    if (!vAlerts.length && !reminders.length && !maturities.length) {
      return `<div class="card flex items-center gap-3"><span class="text-2xl">✅</span><div><p class="font-medium">Totul este în regulă</p><p class="text-sm text-slate-500">Nicio expirare sau cotizație restantă.</p></div></div>`;
    }
    const vHtml = vAlerts.map((a) => `<div class="${LEVEL_CLS[a.level]} flex items-center gap-3">
      <span class="text-xl">🚗</span>
      <div class="flex-1 min-w-0"><p class="font-medium">${esc(a.docLabel)} — ${esc(a.vehicle.name)} ${a.vehicle.plate_number ? `<span class="text-slate-500 font-normal">(${esc(a.vehicle.plate_number)})</span>` : ''}</p>
      <p class="text-sm">${a.level === 'expired' ? 'Expirat' : 'Expiră'} pe ${Calc.formatDate(a.date)} · <strong>${Calc.formatDays(a.days)}</strong></p></div>
      ${adminView ? `<button data-action="edit" data-collection="vehicles" data-id="${esc(a.vehicle.id)}" class="btn-secondary btn-sm">Reînnoit</button>` : ''}
    </div>`).join('');
    const rHtml = reminders.map(({ account: a, daysLate }) => `<div class="alert-pink flex flex-wrap items-center gap-3">
      <span class="text-xl">🐷</span>
      <div class="flex-1 min-w-[12rem]"><p class="font-medium">Cotizație ${esc(a.account_type)} — ${esc(memberName(a.child_id))}</p>
      <p class="text-sm">${money(a.monthly_contribution.target_amount, a.currency)} · scadentă pe ${a.monthly_contribution.due_day} ${daysLate > 0 ? `(<strong>întârziere ${daysLate} ${daysLate === 1 ? 'zi' : 'zile'}</strong>)` : '(<strong>azi</strong>)'}</p></div>
      <button data-action="markPaid" data-id="${esc(a.id)}" class="btn-primary btn-sm">✓ Marchează ca alimentat</button>
    </div>`).join('');
    const mHtml = maturities.map(({ account: a, days }) => `<div class="alert-indigo flex items-center gap-3">
      <span class="text-xl">🏦</span>
      <div class="flex-1"><p class="font-medium">Scadență depozit — ${esc(a.bank_name)}${a.owner_id ? ` (${esc(memberName(a.owner_id))})` : ''}</p>
      <p class="text-sm">${money(a.principal_amount, a.currency)} → <strong>${money(Calc.depositReturn(a).value, a.currency)}</strong> · ${Calc.formatDate(a.maturity_date)} · <strong>${days < 0 ? `scadent de ${-days} zile` : Calc.formatDays(days)}</strong></p></div></div>`).join('');
    return `<div class="space-y-3">${rHtml}${vHtml}${mHtml}</div>`;
  }

  function renderDashboard() {
    if (!isAdmin()) return renderViewerDashboard();
    const nw = Calc.netWorth(D());
    const cats = Object.keys(Calc.CATEGORIES).filter((c) => nw.byCat[c] > 0);
    const members = D().family_members.map((m) => ({ m, v: nw.byMember[m.id] || 0 })).sort((a, b) => b.v - a.v);
    const maxV = Math.max(1, ...members.map((x) => x.v));
    const missingRates = nw.assets.filter((a) => !Calc.rateKnown(a.currency, M()));

    return `
      ${sectionHeader('Panou principal', `Actualizat: ${new Date(M().last_updated).getFullYear() > 2000 ? new Date(M().last_updated).toLocaleString('ro-RO') : '—'}`)}
      <div class="grid gap-4 lg:grid-cols-3">
        <section class="card lg:col-span-2 bg-gradient-to-br from-teal-700 to-teal-900 text-white border-0">
          <p class="text-teal-100 text-sm">Avere netă totală a familiei</p>
          <p class="text-4xl sm:text-5xl font-bold mt-1 tabular-nums">${money(nw.total)}</p>
          <p class="text-teal-100 text-sm mt-1">${nw.assets.length} active · EUR ${M().exchange_rates.EUR || '—'} · USD ${M().exchange_rates.USD || '—'}</p>
          ${nw.total > 0 ? `<div class="flex h-3 gap-[2px] rounded-full overflow-hidden mt-5">${cats.map((c) => `<div data-tip="${Calc.CATEGORIES[c].label} · ${esc(money(nw.byCat[c]))} · ${Math.round((nw.byCat[c] / nw.total) * 100)}%" style="flex:${nw.byCat[c]} 0 0;background:${Calc.CATEGORIES[c].color}"></div>`).join('')}</div>
          <ul class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 mt-4 text-sm">${cats.map((c) => `<li class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white/40" style="background:${Calc.CATEGORIES[c].color}"></span><span class="truncate">${Calc.CATEGORIES[c].label}</span><span class="ml-auto tabular-nums text-teal-50">${Math.round((nw.byCat[c] / nw.total) * 100)}%</span></li>`).join('')}</ul>` : ''}
          ${missingRates.length ? `<p class="mt-4 text-sm bg-rose-500/30 rounded-lg px-3 py-2">⚠ ${missingRates.length} active au monede fără curs de schimb și nu sunt incluse. Adaugă cursul în Setări.</p>` : ''}
          ${nw.unallocated > 0.5 ? `<p class="mt-2 text-sm text-teal-100">Nealocat pe membri: ${money(nw.unallocated)}</p>` : ''}
        </section>
        <section class="card">
          <h3 class="font-semibold mb-3">Alerte & remindere</h3>
          ${alertsHtml(true)}
        </section>
      </div>
      <section class="card mt-4">
        <div class="flex items-center justify-between gap-3 mb-4"><h3 class="font-semibold">Defalcare pe membri (Account Splitting)</h3>
          <button data-action="nav" data-view="analysis" class="btn-ghost btn-sm">🔎 Analiză detaliată →</button></div>
        <ul class="space-y-4">${members.map(({ m, v }) => `<li>
          <div class="flex items-center gap-3 cursor-pointer rounded-lg hover:bg-slate-50 -m-1 p-1" data-action="analyzeMember" data-value="${esc(m.id)}" title="Analizează averea lui ${esc(m.name)}">${avatar(m, 'w-8 h-8 text-sm')}
            <div class="flex-1 min-w-0"><div class="flex justify-between gap-2"><span class="font-medium truncate">${esc(m.name)}</span><span class="font-semibold tabular-nums">${money(v)}</span></div>
            <div class="mt-1.5">${progressBar((v / maxV) * 100, memberColor(m.id), 'h-2')}</div>
            <p class="text-xs text-slate-500 mt-1">${nw.total ? ((v / nw.total) * 100).toFixed(1) : 0}% din total · ${Calc.memberAssets(D(), m.id).length} active</p></div>
          </div></li>`).join('')}</ul>
      </section>
      <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mt-4">
        ${Object.keys(Calc.CATEGORIES).map((c) => {
          const view = { investment_accounts: 'investments', grandparents_accounts: 'grandparents', real_estate: 'realestate', children_savings: 'children', vehicles: 'vehicles' }[c];
          return `<button data-action="nav" data-view="${view}" class="card card-hover text-left">
            <span class="text-xs font-medium" style="color:${Calc.CATEGORIES[c].color}">${Calc.CATEGORIES[c].label}</span>
            <p class="text-xl font-bold mt-1 tabular-nums">${money(nw.byCat[c] || 0)}</p>
            <p class="text-xs text-slate-500">${D()[c].length} înregistrări</p></button>`;
        }).join('')}
      </section>`;
  }

  function renderViewerDashboard() {
    const me = currentMember();
    const list = Calc.memberAssets(D(), me.id);
    const total = sum(list.map((a) => a.share));
    return `
      <div class="card bg-gradient-to-br from-teal-700 to-teal-900 text-white border-0 viewer-xl">
        <p class="text-teal-100">Bună, ${esc(me.name)}!</p>
        <p class="text-teal-100 mt-4 text-sm">Partea dumneavoastră din patrimoniul familiei</p>
        <p class="text-5xl font-bold mt-1 tabular-nums">${money(total)}</p>
        <p class="text-teal-100 mt-2">${list.length} active</p>
      </div>
      <h3 class="font-semibold text-lg mt-6 mb-3">Alerte</h3>
      ${alertsHtml(false)}
      <button data-action="nav" data-view="myassets" class="btn-primary mt-6 w-full sm:w-auto text-lg py-3">📁 Vezi activele mele</button>`;
  }

  function renderMyAssets() {
    const me = currentMember();
    const list = Calc.memberAssets(D(), me.id);
    if (!list.length) return sectionHeader('Activele mele') + emptyState('Nu aveți active alocate.');
    const byCat = {};
    list.forEach((a) => { (byCat[a.cat] = byCat[a.cat] || []).push(a); });
    return sectionHeader('Activele mele', 'Doar activele la care participați — vizualizare') +
      Object.keys(byCat).map((c) => `<section class="mb-6">
        <h3 class="font-semibold mb-2" style="color:${Calc.CATEGORIES[c].color}">${Calc.CATEGORIES[c].label}</h3>
        <div class="grid gap-3 md:grid-cols-2">${byCat[c].map((a) => {
          const item = D()[c].find((x) => x.id === a.id) || {};
          const extra = c === 'grandparents_accounts' && item.maturity_date ? `Scadență: ${Calc.formatDate(item.maturity_date)} · Dobândă ${item.interest_rate || 0}%`
            : c === 'real_estate' ? [item.surface_area, item.legal_status].filter(Boolean).map(esc).join(' · ')
            : c === 'vehicles' ? esc(item.plate_number || '') : esc(item.notes || '');
          return `<article class="card viewer-xl">
            <p class="font-semibold text-lg">${esc(a.label)}</p>
            ${extra ? `<p class="text-sm text-slate-500 mt-1">${extra}</p>` : ''}
            <div class="flex justify-between items-end mt-3 gap-2">
              <div><p class="text-xs text-slate-500">Partea dvs. (${a.pct}%)</p><p class="text-2xl font-bold tabular-nums">${money(a.share)}</p></div>
              <p class="text-sm text-slate-500 text-right">din ${money(a.value)}</p>
            </div></article>`;
        }).join('')}</div></section>`).join('');
  }

  /* ---------- Analiză avere (filtre + mai multe vizualizări) ---------- */
  const analysis = Object.assign(
    { members: [], cats: [], currency: 'RON', group: 'member', sortKey: 'value', sortDir: 'desc', search: '' },
    loadJSON(LS.ANALYSIS, {}),
    { search: '' }
  );
  analysis.cats = (analysis.cats || []).filter((c) => !['real_estate', 'vehicles'].includes(c));
  const saveAnalysis = () => { try { localStorage.setItem(LS.ANALYSIS, JSON.stringify(Object.assign({}, analysis, { search: '' }))); } catch (e) { /* ignore */ } };

  const GROUPS = [
    { id: 'member', label: 'Pe membri', admin: true },
    { id: 'category', label: 'Pe categorii' },
    { id: 'matrix', label: 'Matrice', admin: true },
    { id: 'institution', label: 'Pe instituție' },
    { id: 'currency', label: 'Pe monedă' },
    { id: 'list', label: 'Listă active' }
  ];

  const dispCur = () => (currencies().includes(analysis.currency) && Calc.rateKnown(analysis.currency, M()) ? analysis.currency : baseCur());
  const conv = (v) => { const c = dispCur(); return c === baseCur() ? v : v / +M().exchange_rates[c]; };
  const dmoney = (v) => Calc.formatMoney(conv(v), dispCur());
  const pctTxt = (v, total) => (total ? `${((v / total) * 100).toFixed(1)}%` : '0%');

  // Imobiliarele și vehiculele nu intră în Analiza averii (doar active financiare).
  const ANALYSIS_EXCLUDED = ['real_estate', 'vehicles'];
  const ANALYSIS_CATS = Object.keys(Calc.CATEGORIES).filter((c) => !ANALYSIS_EXCLUDED.includes(c));
  const analysisBaseRows = () => Calc.shareRows(D()).filter((r) => ANALYSIS_CATS.includes(r.cat));

  function analysisMembers() {
    if (!isAdmin()) return [state.profileId];
    return analysis.members.filter((id) => id === Calc.UNALLOCATED || member(id));
  }

  function analysisRows() {
    let rows = analysisBaseRows();
    const mems = analysisMembers();
    if (mems.length) rows = rows.filter((r) => mems.includes(r.member_id));
    if (analysis.cats.length) rows = rows.filter((r) => analysis.cats.includes(r.cat));
    return rows;
  }

  function groupMeta(dim, key) {
    if (dim === 'member') return key === Calc.UNALLOCATED ? { label: 'Nealocat', color: Calc.OTHER_COLOR } : { label: memberName(key), color: memberColor(key) };
    if (dim === 'category') return Calc.CATEGORIES[key];
    if (dim === 'currency') { const i = currencies().indexOf(key); return { label: key, color: i >= 0 && i < Calc.PALETTE.length ? Calc.PALETTE[i] : Calc.OTHER_COLOR }; }
    return { label: key, color: '#2a78d6' }; // instituții: o singură nuanță; identitatea e dată de etichetă
  }

  function groupBy(rows, dim) {
    const keyOf = { member: (r) => r.member_id, category: (r) => r.cat, currency: (r) => r.currency, institution: (r) => r.institution }[dim];
    const map = new Map();
    rows.forEach((r) => {
      const k = keyOf(r);
      const g = map.get(k) || { key: k, value: 0, assets: new Set() };
      g.value += r.value; g.assets.add(r.assetId);
      map.set(k, g);
    });
    return [...map.values()].sort((a, b) => b.value - a.value);
  }

  function chip(action, value, label, on, color) {
    return `<button data-action="${action}" data-value="${esc(value)}" class="chip ${on ? 'chip-on' : ''}" aria-pressed="${on}">
      ${color ? `<span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:${color}"></span>` : ''}${esc(label)}</button>`;
  }

  /** Bară 100% compusă (cu goluri de 2px între segmente) — partea din întreg. */
  function compositionBar(groups, total, dim) {
    if (!total) return '';
    return `<div class="flex h-4 gap-[2px] rounded overflow-hidden" role="img" aria-label="Compoziție">
      ${groups.filter((g) => g.value > 0).map((g) => { const m = groupMeta(dim, g.key); return `<div class="h-4 first:rounded-l last:rounded-r" style="flex:${g.value} 0 0;background:${m.color}" data-tip="${esc(m.label)} · ${esc(dmoney(g.value))} · ${pctTxt(g.value, total)}"></div>`; }).join('')}
    </div>`;
  }

  /** Bare orizontale sortate, cu etichete directe (nume, valoare, %) — servesc și ca tabel. */
  function barList(groups, total, dim) {
    if (!groups.length) return '<p class="text-sm text-slate-500">Niciun rezultat pentru filtrele alese.</p>';
    const max = Math.max(...groups.map((g) => g.value), 1);
    return `<ul class="space-y-3.5">${groups.map((g) => {
      const m = groupMeta(dim, g.key);
      const drill = dim === 'member' && g.key !== Calc.UNALLOCATED ? `data-action="drillMember" data-value="${esc(g.key)}"`
        : dim === 'category' ? `data-action="drillCategory" data-value="${esc(g.key)}"` : '';
      return `<li>
        <${drill ? 'button' : 'div'} ${drill} class="w-full text-left group" data-tip="${esc(m.label)} · ${esc(dmoney(g.value))} · ${pctTxt(g.value, total)} · ${g.assets.size} active">
          <div class="flex justify-between gap-3 text-sm">
            <span class="flex items-center gap-2 min-w-0"><span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:${m.color}"></span>
              <span class="truncate font-medium ${drill ? 'group-hover:underline' : ''}">${esc(m.label)}</span><span class="text-slate-400 text-xs whitespace-nowrap">${g.assets.size} active</span></span>
            <span class="tabular-nums font-semibold whitespace-nowrap">${dmoney(g.value)} <span class="text-slate-500 font-normal w-12 inline-block text-right">${pctTxt(g.value, total)}</span></span>
          </div>
          <div class="mt-1.5 h-2.5 rounded-r bg-slate-100"><div class="h-2.5 rounded-r" style="width:${Math.max(0.5, (g.value / max) * 100)}%;background:${m.color}"></div></div>
        </${drill ? 'button' : 'div'}></li>`;
    }).join('')}</ul>`;
  }

  /** Matrice membri × categorii cu nuanțare secvențială (o singură nuanță, deschis→închis). */
  function matrixHtml(rows) {
    const mems = [...new Set(rows.map((r) => r.member_id))]
      .sort((a, b) => sum(rows.filter((r) => r.member_id === b).map((r) => r.value)) - sum(rows.filter((r) => r.member_id === a).map((r) => r.value)));
    const cats = Object.keys(Calc.CATEGORIES).filter((c) => rows.some((r) => r.cat === c));
    if (!mems.length) return '<p class="text-sm text-slate-500">Niciun rezultat pentru filtrele alese.</p>';
    const cell = (m, c) => sum(rows.filter((r) => r.member_id === m && r.cat === c).map((r) => r.value));
    const max = Math.max(1, ...mems.flatMap((m) => cats.map((c) => cell(m, c))));
    const total = sum(rows.map((r) => r.value));
    const name = (m) => (m === Calc.UNALLOCATED ? 'Nealocat' : memberName(m));
    return `<div class="overflow-x-auto -mx-1"><table class="matrix w-full text-sm">
      <thead><tr><th class="text-left">Membru</th>${cats.map((c) => `<th><span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm" style="background:${Calc.CATEGORIES[c].color}"></span>${Calc.CATEGORIES[c].label}</span></th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${mems.map((m) => {
        const rowTotal = sum(cats.map((c) => cell(m, c)));
        return `<tr><th class="text-left font-medium whitespace-nowrap">${esc(name(m))}</th>
          ${cats.map((c) => { const v = cell(m, c); const t = v / max; return `<td style="${v ? `background:rgba(42,120,214,${(0.08 + 0.82 * t).toFixed(3)});color:${t > 0.8 ? '#fff' : '#0f172a'}` : ''}" data-tip="${esc(name(m))} · ${esc(Calc.CATEGORIES[c].label)} · ${esc(dmoney(v))}">${v ? dmoney(v) : '<span class="text-slate-300">—</span>'}</td>`; }).join('')}
          <td class="font-semibold">${dmoney(rowTotal)}<div class="text-xs text-slate-500 font-normal">${pctTxt(rowTotal, total)}</div></td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><th class="text-left">Total</th>${cats.map((c) => `<td>${dmoney(sum(rows.filter((r) => r.cat === c).map((r) => r.value)))}</td>`).join('')}<td>${dmoney(total)}</td></tr></tfoot>
    </table></div>`;
  }

  function listItems(rows) {
    const map = new Map();
    rows.forEach((r) => {
      const it = map.get(r.assetId) || { id: r.assetId, label: r.label, cat: r.cat, institution: r.institution, currency: r.currency, assetValue: r.assetValue, value: 0, holders: [] };
      it.value += r.value;
      it.holders.push(`${r.member_id === Calc.UNALLOCATED ? 'Nealocat' : memberName(r.member_id)} ${Math.round(r.pct * 100) / 100}%`);
      map.set(r.assetId, it);
    });
    const q = analysis.search.trim().toLowerCase();
    let items = [...map.values()];
    if (q) items = items.filter((i) => `${i.label} ${i.institution} ${i.holders.join(' ')}`.toLowerCase().includes(q));
    const dir = analysis.sortDir === 'asc' ? 1 : -1;
    const k = analysis.sortKey;
    items.sort((a, b) => {
      const va = k === 'value' ? a.value : k === 'cat' ? Calc.CATEGORIES[a.cat].label : (a[k] || '').toString();
      const vb = k === 'value' ? b.value : k === 'cat' ? Calc.CATEGORIES[b.cat].label : (b[k] || '').toString();
      return (typeof va === 'number' ? va - vb : va.localeCompare(vb, 'ro')) * dir;
    });
    return items;
  }

  function listTableHtml(rows) {
    const items = listItems(rows);
    const th = (key, label, cls = '') => `<th class="${cls}"><button data-action="sortList" data-value="${key}" class="inline-flex items-center gap-1 font-semibold hover:text-slate-900">${label}${analysis.sortKey === key ? (analysis.sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>`;
    if (!items.length) return '<p class="text-sm text-slate-500 py-4">Niciun activ nu corespunde căutării.</p>';
    const total = sum(items.map((i) => i.value));
    return `<div class="overflow-x-auto -mx-1"><table class="matrix w-full text-sm">
      <thead><tr>${th('label', 'Activ', 'text-left')}${th('cat', 'Categorie', 'text-left')}${th('institution', 'Instituție', 'text-left hidden md:table-cell')}<th class="text-left hidden sm:table-cell">Deținători</th>${th('value', analysisMembers().length ? 'Partea selecției' : 'Valoare')}</tr></thead>
      <tbody>${items.map((i) => `<tr>
        <td class="text-left"><span class="font-medium">${esc(i.label)}</span>${i.currency !== baseCur() ? `<div class="text-xs text-slate-500">${esc(i.currency)}</div>` : ''}</td>
        <td class="text-left whitespace-nowrap"><span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-sm" style="background:${Calc.CATEGORIES[i.cat].color}"></span>${Calc.CATEGORIES[i.cat].label}</span></td>
        <td class="text-left hidden md:table-cell">${esc(i.institution)}</td>
        <td class="text-left hidden sm:table-cell text-slate-600">${esc(i.holders.join(', '))}</td>
        <td class="font-semibold whitespace-nowrap">${dmoney(i.value)}${Math.abs(i.value - i.assetValue) > 0.5 ? `<div class="text-xs text-slate-500 font-normal">din ${dmoney(i.assetValue)}</div>` : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td class="text-left" colspan="2">${items.length} active</td><td class="hidden md:table-cell"></td><td class="hidden sm:table-cell"></td><td>${dmoney(total)}</td></tr></tfoot>
    </table></div>`;
  }

  function renderAnalysis() {
    const admin = isAdmin();
    const groups = GROUPS.filter((g) => admin || !g.admin);
    if (!groups.some((g) => g.id === analysis.group)) analysis.group = admin ? 'member' : 'category';
    const rows = analysisRows();
    const total = sum(rows.map((r) => r.value));
    const family = sum(analysisBaseRows().map((r) => r.value));
    const assetCount = new Set(rows.map((r) => r.assetId)).size;
    const mems = analysisMembers();
    const hasUnalloc = analysisBaseRows().some((r) => r.member_id === Calc.UNALLOCATED);
    const filtered = admin && (analysis.members.length || analysis.cats.length);

    const selLabel = !admin ? `Partea ta (${esc(currentMember().name)})`
      : !mems.length ? 'Toată familia'
      : mems.map((id) => (id === Calc.UNALLOCATED ? 'Nealocat' : esc(memberName(id)))).join(' + ');
    const catLabel = analysis.cats.length ? ' · ' + analysis.cats.map((c) => Calc.CATEGORIES[c].label).join(', ') : '';

    let body;
    if (analysis.group === 'matrix') body = matrixHtml(rows);
    else if (analysis.group === 'list') body = `<input id="analysis-search" type="search" value="${esc(analysis.search)}" placeholder="Caută activ, instituție sau membru…" class="input mb-3" aria-label="Caută">
      <div id="analysis-list">${listTableHtml(rows)}</div>
      <div class="flex justify-end mt-3"><button data-action="exportCsv" class="btn-secondary btn-sm">⬇ Exportă CSV</button></div>`;
    else {
      const g = groupBy(rows, analysis.group);
      body = `${compositionBar(g, total, analysis.group)}<div class="mt-5">${barList(g, total, analysis.group)}</div>`;
    }

    return `${sectionHeader(admin ? 'Analiză avere' : 'Analiza averii tale', admin ? 'Filtrează pe membri și categorii și alege cum să grupezi valorile' : 'Filtrează pe categorii și alege cum să grupezi valorile')}
      <section class="card mb-4 space-y-3 no-print">
        ${admin ? `<div class="flex flex-wrap items-center gap-2"><span class="filter-label">Membri</span>
          ${chip('allMembers', '', 'Toți', !analysis.members.length)}
          ${D().family_members.map((m) => chip('toggleMember', m.id, m.name, analysis.members.includes(m.id), memberColor(m.id))).join('')}
          ${hasUnalloc ? chip('toggleMember', Calc.UNALLOCATED, 'Nealocat', analysis.members.includes(Calc.UNALLOCATED), Calc.OTHER_COLOR) : ''}</div>` : ''}
        <div class="flex flex-wrap items-center gap-2"><span class="filter-label">Categorii</span>
          ${chip('allCats', '', 'Toate', !analysis.cats.length)}
          ${ANALYSIS_CATS.map((c) => chip('toggleCat', c, Calc.CATEGORIES[c].label, analysis.cats.includes(c), Calc.CATEGORIES[c].color)).join('')}</div>
        <div class="flex flex-wrap items-center gap-2"><span class="filter-label">Monedă</span>
          <select id="analysis-currency" class="input w-auto py-1.5" aria-label="Moneda de afișare">${currencies().filter((c) => Calc.rateKnown(c, M())).map((c) => `<option ${c === dispCur() ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          ${filtered ? '<button data-action="resetAnalysis" class="btn-ghost btn-sm ml-auto">✕ Resetează filtrele</button>' : ''}</div>
      </section>

      <section class="grid gap-4 sm:grid-cols-3 mb-4">
        <div class="card sm:col-span-2 bg-gradient-to-br from-teal-700 to-teal-900 text-white border-0">
          <p class="text-teal-100 text-sm">${selLabel}${catLabel}</p>
          <p class="text-4xl font-bold mt-1 tabular-nums">${dmoney(total)}</p>
          ${dispCur() !== baseCur() ? `<p class="text-teal-100 text-sm mt-1 tabular-nums">≈ ${money(total)}</p>` : ''}
        </div>
        <div class="card grid grid-cols-2 sm:grid-cols-1 gap-3">
          <div><p class="text-xs text-slate-500">Din averea familiei</p><p class="text-2xl font-bold tabular-nums">${pctTxt(total, family)}</p></div>
          <div><p class="text-xs text-slate-500">Active incluse</p><p class="text-2xl font-bold tabular-nums">${assetCount}</p></div>
        </div>
      </section>

      <section class="card">
        <div class="flex gap-1 overflow-x-auto no-scrollbar border-b border-slate-100 -mx-5 px-4 mb-5" role="tablist">
          ${groups.map((g) => `<button data-action="setGroup" data-value="${g.id}" role="tab" aria-selected="${analysis.group === g.id}" class="tab ${analysis.group === g.id ? 'tab-active' : ''}">${g.label}</button>`).join('')}
        </div>
        ${body}
      </section>`;
  }

  function exportCsv() {
    const items = listItems(analysisRows());
    const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [['Activ', 'Categorie', 'Instituție', 'Moneda originală', 'Deținători', `Valoare (${dispCur()})`].map(q).join(';')]
      .concat(items.map((i) => [i.label, Calc.CATEGORIES[i.cat].label, i.institution, i.currency, i.holders.join(', '), conv(i.value).toFixed(2).replace('.', ',')].map(q).join(';')));
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `avere_${Calc.todayISO()}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function toggleIn(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); }
  function updateAnalysis(fn) { fn(); saveAnalysis(); render(); }

  /* ---------- Investiții ---------- */
  function renderInvestments() {
    const list = D().investment_accounts;
    const total = sum(list.map((a) => Calc.toBase(a.total_value, a.currency, M())));
    return sectionHeader('Investiții & Brokeraj', `Total: <strong>${money(total)}</strong> · ${list.length} conturi`, 'investment_accounts') +
      (list.length ? `<div class="grid gap-4 md:grid-cols-2">${list.map((a) => {
        const base = Calc.toBase(a.total_value, a.currency, M());
        return `<article class="card">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="font-semibold text-lg">${esc(a.platform)}</h3><p class="text-sm text-slate-500">${esc(a.account_type)}</p></div>${cardActions('investment_accounts', a.id)}</div>
          <div class="mt-3">${valueBlock(a.total_value, a.currency)}</div>
          ${Calc.isDeposit(a.account_type) && (Calc.num(a.interest_rate) > 0 || a.maturity_date) ? `<dl class="grid grid-cols-2 gap-2 mt-3 text-sm">
            <div class="stat"><dt>Dobândă</dt><dd>${Calc.num(a.interest_rate)}% / an</dd></div>
            <div class="stat"><dt>Scadență</dt><dd>${Calc.formatDate(a.maturity_date)}${Calc.daysUntil(a.maturity_date) != null ? ` <span class="badge bg-slate-100 text-slate-600">${Calc.daysUntil(a.maturity_date) < 0 ? 'scadent' : Calc.formatDays(Calc.daysUntil(a.maturity_date))}</span>` : ''}</dd></div>
          </dl>${Calc.num(a.interest_rate) > 0 ? `<div class="mt-3">${depositSummaryHtml(a, a.currency)}</div>` : ''}` : ''}
          ${splitsHtml(a.splits, base)}
          ${a.notes ? `<p class="mt-3 text-sm text-slate-600 border-t border-slate-100 pt-3">${esc(a.notes)}</p>` : ''}
        </article>`;
      }).join('')}</div>` : emptyState('Niciun cont de investiții încă.', 'investment_accounts'));
  }

  /* ---------- Conturi bunici ---------- */
  function renderGrandparents() {
    const list = D().grandparents_accounts;
    const total = sum(list.map((a) => Calc.toBase(a.principal_amount, a.currency, M())));
    return sectionHeader('Conturi Bunici', `Total: <strong>${money(total)}</strong> · ${list.length} conturi`, 'grandparents_accounts') +
      (list.length ? `<div class="grid gap-4 md:grid-cols-2">${list.map((a) => {
        const base = Calc.toBase(a.principal_amount, a.currency, M());
        const days = Calc.daysUntil(a.maturity_date);
        const lvl = days != null && days <= 30 ? (days < 7 ? 'red' : 'yellow') : null;
        const splits = a.splits && a.splits.length ? a.splits : [{ member_id: a.owner_id, percentage: 100 }];
        return `<article class="card">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="font-semibold text-lg">${esc(a.bank_name)}</h3><p class="text-sm text-slate-500">${esc(a.account_type)}</p></div>${cardActions('grandparents_accounts', a.id)}</div>
          <p class="text-sm mt-2 flex items-center gap-2">${member(a.owner_id) ? avatar(member(a.owner_id), 'w-5 h-5 text-[10px]') : ''} Titular: <strong>${esc(memberName(a.owner_id))}</strong></p>
          <div class="mt-3">${valueBlock(a.principal_amount, a.currency)}</div>
          <dl class="grid grid-cols-2 gap-2 mt-3 text-sm">
            <div class="stat"><dt>Dobândă</dt><dd>${Calc.num(a.interest_rate)}% / an</dd></div>
            <div class="stat"><dt>Dobândă anuală est.</dt><dd>${money(Calc.annualInterest(a), a.currency)}</dd></div>
            ${a.start_date ? `<div class="stat col-span-2"><dt>Constituit</dt><dd>${Calc.formatDate(a.start_date)}</dd></div>` : ''}
            <div class="stat col-span-2"><dt>Scadență</dt><dd>${Calc.formatDate(a.maturity_date)} ${days != null ? `<span class="badge ${lvl ? LEVEL_BADGE[lvl] : 'bg-slate-100 text-slate-600'}">${days < 0 ? `scadent de ${-days} zile` : Calc.formatDays(days)}</span>` : ''}</dd></div>
            ${a.iban_or_account ? `<div class="stat col-span-2"><dt>IBAN / Cont</dt><dd class="font-mono text-xs break-all">${esc(a.iban_or_account)}</dd></div>` : ''}
          </dl>
          ${Calc.num(a.interest_rate) > 0 ? `<div class="mt-3">${depositSummaryHtml(a, a.currency)}</div>` : ''}
          ${splitsHtml(splits, base)}
        </article>`;
      }).join('')}</div>` : emptyState('Niciun cont bancar adăugat.', 'grandparents_accounts'));
  }

  /* ---------- Imobiliare ---------- */
  function renderRealEstate() {
    const list = D().real_estate;
    const total = sum(list.map((a) => Calc.toBase(Calc.num(a.estimated_value) * Calc.num(a.share_percentage) / 100, a.currency, M())));
    return sectionHeader('Imobiliare & Terenuri', `Valoare netă deținută: <strong>${money(total)}</strong>`, 'real_estate') +
      (list.length ? `<div class="grid gap-4 md:grid-cols-2">${list.map((a) => {
        const net = Calc.num(a.estimated_value) * Calc.num(a.share_percentage) / 100;
        return `<article class="card">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="font-semibold text-lg">${esc(a.title)}</h3>
            <p class="text-sm text-slate-500">${esc(a.surface_area || '')}${a.surface_area ? ' · ' : ''}Proprietar: ${esc(memberName(a.owner_id))}</p></div>${cardActions('real_estate', a.id)}</div>
          <div class="mt-3">${valueBlock(net, a.currency)}</div>
          <p class="text-sm text-slate-500 mt-1">Cotă ${Calc.num(a.share_percentage)}% din ${money(a.estimated_value, a.currency)}</p>
          <div class="mt-2">${progressBar(Calc.num(a.share_percentage), '#f59e0b', 'h-2')}</div>
          ${a.legal_status ? `<div class="mt-4 text-sm"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Status cadastral / succesoral</p><p class="mt-1">📜 ${esc(a.legal_status)}</p></div>` : ''}
          ${a.notes ? `<div class="mt-3 text-sm"><p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Note & locația actelor</p><p class="mt-1">📁 ${esc(a.notes)}</p></div>` : ''}
        </article>`;
      }).join('')}</div>` : emptyState('Nicio proprietate adăugată.', 'real_estate'));
  }

  /* ---------- Copii ---------- */
  const isCentenar = (a) => /centenar/i.test(a.account_type || '');

  function childAccountCard(a, { kid = false } = {}) {
    const p = Calc.bonusProgress(a);
    const centenar = isCentenar(a);
    const mc = a.monthly_contribution;
    const color = '#ec4899';
    const history = a.balance_history && a.balance_history.length ? a.balance_history : [{ date: Calc.todayISO(), balance: a.current_balance }];
    return `<article class="card ${kid ? 'p-6 sm:p-8' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><h3 class="font-semibold ${kid ? 'text-xl' : 'text-lg'}">${kid ? (centenar ? '🐷 Pușculița mea' : `🐷 ${esc(a.account_type || 'Contul meu')}`) : esc(memberName(a.child_id))}</h3>
        <p class="text-sm text-slate-500">${esc(a.account_type)}${!kid && a.iban ? ` · <span class="font-mono text-xs">${esc(a.iban)}</span>` : ''}</p></div>
        ${kid ? '' : cardActions('children_savings', a.id)}
      </div>
      <p class="${kid ? 'text-5xl sm:text-6xl' : 'text-3xl'} font-bold mt-3 tabular-nums" style="color:${color}">${money(a.current_balance, a.currency)}</p>
      ${centenar ? `<div class="mt-5">
        <div class="flex justify-between text-sm mb-1.5"><span class="font-medium">${kid ? 'Drumul spre bonusul de la stat' : `Prag anual pentru prima de stat (${a.tracker_year || new Date().getFullYear()})`}</span><span class="tabular-nums">${money(p.deposited)} / ${money(p.target)}</span></div>
        ${progressBar(p.pct, p.eligible ? '#10b981' : color, kid ? 'h-6' : 'h-3')}
        <p class="text-sm mt-2 ${p.eligible ? 'text-emerald-700 font-medium' : 'text-slate-600'}">${p.eligible
          ? `🎉 ${kid ? 'Super! Vei primi' : 'Prag atins — eligibil pentru'} prima de ${money(p.bonus)}${kid ? ' de la stat!' : '.'}`
          : `${kid ? 'Mai trebuie' : 'Mai sunt necesari'} ${money(p.remaining)} ${kid ? 'ca să primești' : 'pentru prima de'} ${kid ? `${money(p.bonus)} cadou de la stat ✨` : money(p.bonus) + '/an.'}`}</p>
      </div>` : ''}
      ${!kid ? `<div class="mt-4 flex flex-wrap items-center gap-3 text-sm border-t border-slate-100 pt-4">
        <span>Cotizație: <strong>${money(mc.target_amount, a.currency)}</strong> / lună, ziua ${mc.due_day}</span>
        ${mc.is_paid_this_month ? `<span class="badge bg-emerald-100 text-emerald-800">✓ Alimentat luna aceasta</span>` : `<span class="badge bg-amber-100 text-amber-800">Neachitat luna aceasta</span>`}
        ${mc.last_payment_date ? `<span class="text-slate-500">Ultima plată: ${Calc.formatDate(mc.last_payment_date)}</span>` : ''}
        ${!mc.is_paid_this_month && isAdmin() ? `<button data-action="markPaid" data-id="${esc(a.id)}" class="btn-primary btn-sm ml-auto">✓ Marchează ca alimentat</button>` : ''}
      </div>` : ''}
      <div class="mt-5"><p class="text-sm font-medium mb-2">${kid ? '📈 Cum a crescut pușculița' : 'Evoluția soldului'}</p>${lineChart(history, color)}</div>
    </article>`;
  }

  const CAT_ICONS = { investment_accounts: '📈', grandparents_accounts: '🏦', real_estate: '🏡', vehicles: '🚗', children_savings: '🐷' };
  const CAT_VIEWS = { investment_accounts: 'investments', grandparents_accounts: 'grandparents', real_estate: 'realestate', vehicles: 'vehicles' };

  // Cota copilului din toate activele, în afară de conturile de economii pentru copii (afișate separat).
  const kidShareRows = (memberId) => Calc.shareRows(D())
    .filter((r) => r.member_id === memberId && r.cat !== 'children_savings' && r.value > 0)
    .sort((a, b) => b.value - a.value);

  function childPortfolioCard(k) {
    const rows = kidShareRows(k.id);
    const savings = D().children_savings.filter((a) => a.child_id === k.id);
    const total = sum(rows.map((r) => r.value)) + sum(savings.map((a) => Calc.toBase(a.current_balance, a.currency, M())));
    const catLabel = (c) => (Calc.CATEGORIES[c] ? Calc.CATEGORIES[c].label : '');
    return `<article class="card">
      <div class="flex flex-wrap items-center gap-3">
        ${avatar(k, 'w-10 h-10 text-base')}
        <div class="flex-1 min-w-[10rem]"><h3 class="font-semibold text-lg">${esc(k.name)}</h3>
          <p class="text-sm text-slate-500">Total pe numele copilului: <strong>${money(total)}</strong></p></div>
        ${isAdmin() ? `<button data-action="addChildInvestment" data-id="${esc(k.id)}" class="btn-primary btn-sm no-print">+ Adaugă investiție</button>` : ''}
      </div>
      ${rows.length || savings.length ? `<ul class="mt-4 divide-y divide-slate-100 text-sm">
        ${savings.map((a) => `<li class="flex items-center gap-3 py-2"><span class="text-lg">🐷</span>
          <span class="flex-1 min-w-0"><span class="block truncate">${esc(a.account_type || 'Cont de economii')}</span><span class="text-xs text-slate-500">${esc(catLabel('children_savings'))}</span></span>
          <span class="font-semibold tabular-nums">${money(a.current_balance, a.currency)}</span></li>`).join('')}
        ${rows.map((r) => `<li class="flex items-center gap-3 py-2"><span class="text-lg">${CAT_ICONS[r.cat] || '💰'}</span>
          <span class="flex-1 min-w-0"><span class="block truncate">${esc(r.label)}</span>
            <span class="text-xs text-slate-500">${esc(catLabel(r.cat))}${r.pct < 99.99 ? ` · cota copilului ${Math.round(r.pct * 100) / 100}%` : ''}</span></span>
          <span class="font-semibold tabular-nums">${money(r.value)}</span>
          ${CAT_VIEWS[r.cat] ? `<button data-action="nav" data-view="${CAT_VIEWS[r.cat]}" class="btn-ghost btn-sm no-print" title="Deschide secțiunea">→</button>` : ''}</li>`).join('')}
      </ul>` : `<p class="mt-3 text-sm text-slate-500">Nicio investiție pe numele copilului încă.</p>`}
    </article>`;
  }

  // Tipurile de investiții care se pot adăuga pentru un copil; copilul e precompletat ca titular.
  const childInvestmentOptions = (childId) => [
    { c: 'investment_accounts', icon: '📈', t: 'Cont de investiții / brokeraj', d: 'Acțiuni, ETF-uri, titluri de stat, fonduri, Pilon III, aur, crypto…',
      preset: { splits: [{ member_id: childId, percentage: 100 }] } },
    { c: 'grandparents_accounts', icon: '🏦', t: 'Depozit / cont bancar', d: 'Depozit la termen, cu dobândă și scadență',
      preset: { owner_id: childId, splits: [{ member_id: childId, percentage: 100 }] } },
    { c: 'children_savings', icon: '🐷', t: 'Cont de economii / Cont Centenar', d: 'Cu cotizație lunară; prima de stat se urmărește doar la Cont Centenar',
      preset: { child_id: childId } },
    { c: 'real_estate', icon: '🏡', t: 'Imobil / teren', d: 'Proprietate pe numele copilului', preset: { owner_id: childId } }
  ];

  function openChildInvestmentPicker(childId) {
    const kid = member(childId);
    if (!kid) return;
    openModal({
      title: `Adaugă investiție pentru ${kid.name}`, noFooter: true,
      body: `<div class="grid gap-2">${childInvestmentOptions(childId).map((o, i) => `<button type="button" data-action="pickChildInvestment" data-id="${esc(childId)}" data-index="${i}" class="card text-left flex items-center gap-3 hover:border-teal-400">
        <span class="text-2xl">${o.icon}</span><span><span class="block font-medium">${esc(o.t)}</span><span class="block text-sm text-slate-500">${esc(o.d)}</span></span></button>`).join('')}</div>`
    });
  }

  function renderChildren() {
    const list = D().children_savings;
    const kids = D().family_members.filter((m) => m.role === 'viewer_restricted');
    return sectionHeader('Economii & Investiții Copii', 'Toate activele pe numele copiilor · Cont Centenar: prag anual de 1.200 RON pentru prima de 600 RON/an', 'children_savings') +
      (kids.length ? `<div class="grid gap-4 lg:grid-cols-2 mb-6">${kids.map(childPortfolioCard).join('')}</div>` : '') +
      (list.length ? `<h3 class="font-semibold text-slate-700 mb-2">Conturi de economii</h3><div class="grid gap-4 lg:grid-cols-2">${list.map((a) => childAccountCard(a)).join('')}</div>` : emptyState('Niciun cont de economii pentru copii.', 'children_savings')) +
      (kids.length ? `<div class="card mt-4 flex flex-wrap items-center gap-3 no-print"><span class="text-2xl">🧒</span><div class="flex-1 min-w-[12rem]"><p class="font-medium">Modul Copil</p><p class="text-sm text-slate-500">Copilul vede pușculița și investițiile pe numele lui. ${currentMember().auth ? 'Revenirea la profilul tău cere parola.' : 'Setează-ți o parolă (🔑 sus) ca să nu poată trece copilul în profilul tău.'}</p></div>
        ${kids.map((k) => `<button data-action="selectProfile" data-id="${esc(k.id)}" class="btn-secondary">${avatar(k, 'w-6 h-6 text-xs')} ${esc(k.name)}</button>`).join('')}</div>` : '');
  }

  function renderChildMode() {
    const me = currentMember();
    const accs = D().children_savings.filter((a) => a.child_id === me.id);
    const first = esc(me.name.split(/[\s(]/)[0] || me.name);
    return `<div class="min-h-screen bg-gradient-to-b from-pink-50 to-amber-50">
      <header class="max-w-3xl mx-auto px-4 pt-6 flex items-center gap-3">
        ${avatar(me, 'w-12 h-12 text-xl')}
        <h1 class="flex-1 text-2xl sm:text-3xl font-bold">Salut, ${first}! 👋</h1>
        <button data-action="switchProfile" class="btn-secondary btn-sm">Ieșire</button>
      </header>
      <main class="max-w-3xl mx-auto px-4 py-6 space-y-5">
        ${accs.length ? accs.map((a) => childAccountCard(a, { kid: true })).join('') : `<div class="card text-center py-12"><p class="text-5xl">🐷</p><p class="mt-3 text-slate-600">Pușculița ta va apărea aici în curând!</p></div>`}
        ${kidInvestmentsCard(me.id)}
      </main></div>`;
  }

  // Activele (altele decât pușculița) în care copilul are o cotă — investiții, depozite, imobiliare, vehicule.
  function kidInvestmentsCard(memberId) {
    const rows = kidShareRows(memberId);
    if (!rows.length) return '';
    const total = sum(rows.map((r) => r.value));
    return `<section class="card p-6 sm:p-8">
      <h2 class="font-semibold text-xl">💼 Investițiile pe numele meu</h2>
      <p class="text-4xl font-bold mt-3 tabular-nums text-emerald-600">${money(total)}</p>
      <p class="text-sm text-slate-500 mt-1">Bani pe care familia i-a pus deoparte pentru tine și care cresc în timp.</p>
      <ul class="mt-5 space-y-3">${rows.map((r) => `<li class="flex items-center gap-3">
        <span class="text-2xl shrink-0">${CAT_ICONS[r.cat] || '💰'}</span>
        <div class="flex-1 min-w-0"><p class="font-medium truncate">${esc(r.label)}</p>
          ${r.pct < 99.99 ? `<p class="text-xs text-slate-500">Partea ta: ${Math.round(r.pct * 100) / 100}%</p>` : ''}</div>
        <span class="font-semibold tabular-nums">${money(r.value)}</span></li>`).join('')}</ul>
    </section>`;
  }

  /* ---------- Vehicule ---------- */
  function renderVehicles() {
    const list = D().vehicles;
    return sectionHeader('Vehicule & Documente', 'Alertă galbenă sub 30 de zile, roșie sub 7 zile', 'vehicles') +
      (list.length ? `<div class="grid gap-4 md:grid-cols-2">${list.map((v) => {
        const docs = v.documents || {};
        return `<article class="card">
          <div class="flex items-start justify-between gap-3"><div class="min-w-0"><h3 class="font-semibold text-lg">${esc(v.name)}</h3>
            <p class="text-sm text-slate-500">${v.plate_number ? `<span class="plate">${esc(v.plate_number)}</span> · ` : ''}${esc(memberName(v.owner_id))}</p></div>${cardActions('vehicles', v.id)}</div>
          <div class="mt-3">${valueBlock(v.estimated_market_value, v.currency)}</div>
          <ul class="mt-4 divide-y divide-slate-100 text-sm">${Object.keys(Calc.DOC_LABELS).map((k) => {
            const d = docs[k] || {};
            const days = Calc.daysUntil(d.expiration_date);
            const lvl = Calc.alertLevel(days);
            return `<li class="py-2 flex items-center gap-3">
              <span class="w-20 font-medium">${Calc.DOC_LABELS[k]}</span>
              <span class="flex-1 min-w-0 text-slate-600 truncate">${d.expiration_date ? Calc.formatDate(d.expiration_date) : '<span class="text-slate-400">nesetat</span>'}${d.insurer ? ` · ${esc(d.insurer)}` : ''}${d.cost ? ` · ${money(d.cost)}` : ''}</span>
              ${days != null ? `<span class="badge ${lvl ? LEVEL_BADGE[lvl] : 'bg-emerald-100 text-emerald-800'}">${lvl === 'expired' ? 'EXPIRAT' : Calc.formatDays(days)}</span>` : ''}
            </li>`;
          }).join('')}</ul>
          <p class="text-sm text-slate-500 mt-2">Cost anual documente: <strong>${money(Calc.vehicleAnnualCost(v))}</strong></p>
        </article>`;
      }).join('')}</div>` : emptyState('Niciun vehicul adăugat.', 'vehicles'));
  }

  /* ---------- Ghid urgență ---------- */
  function renderGuide() {
    const g = D().emergency_guide;
    const nw = Calc.netWorth(D());
    const cats = Object.keys(Calc.CATEGORIES);
    const detail = (c, id) => {
      const it = D()[c].find((x) => x.id === id) || {};
      return [it.iban_or_account || it.iban, it.legal_status, it.notes, it.maturity_date ? `Scadență ${Calc.formatDate(it.maturity_date)}` : '']
        .filter(Boolean).map(esc).join(' · ');
    };
    return `<div class="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div><h2 class="text-2xl font-bold tracking-tight">Ghid de Urgență & Succesiune</h2><p class="text-slate-500 mt-1">Vizibil doar administratorilor. Printează-l și păstrează-l lângă acte.</p></div>
        <button data-action="print" class="btn-secondary no-print">🖨 Printează</button>
      </div>
      <section class="card">
        <h3 class="font-semibold mb-2">Instrucțiuni</h3>
        <form data-form="guide" class="no-print">
          <textarea name="instructions" rows="5" class="input">${esc(g.instructions)}</textarea>
          <div class="flex justify-end mt-2"><button class="btn-primary btn-sm">Salvează instrucțiunile</button></div>
        </form>
        <p class="print-only whitespace-pre-wrap">${esc(g.instructions)}</p>
      </section>
      <section class="card mt-4">
        <div class="flex items-center justify-between mb-3"><h3 class="font-semibold">Contacte de încredere</h3><button data-action="addContact" class="btn-secondary btn-sm no-print">+ Contact</button></div>
        ${g.trusted_contacts.length ? `<ul class="divide-y divide-slate-100">${g.trusted_contacts.map((c, i) => `<li class="py-2.5 flex items-center gap-3">
          <span class="text-xl">📇</span>
          <div class="flex-1 min-w-0"><p class="font-medium">${esc(c.name)}</p><p class="text-sm text-slate-500">${esc(c.role)}</p></div>
          <a href="tel:${esc(String(c.phone || '').replace(/[^\d+]/g, ''))}" class="text-teal-700 font-medium tabular-nums">${esc(c.phone)}</a>
          <button data-action="editContact" data-index="${i}" class="btn-ghost btn-sm no-print" aria-label="Editează">✎</button>
          <button data-action="deleteContact" data-index="${i}" class="btn-ghost btn-sm text-rose-600 no-print" aria-label="Șterge">🗑</button></li>`).join('')}</ul>` : '<p class="text-sm text-slate-500">Niciun contact adăugat.</p>'}
      </section>
      <section class="card mt-4">
        <h3 class="font-semibold mb-1">Inventarul patrimoniului</h3>
        <p class="text-sm text-slate-500 mb-4">Generat automat · Total ${money(nw.total)} · ${new Date().toLocaleDateString('ro-RO')}</p>
        ${cats.filter((c) => D()[c].length).map((c) => `<h4 class="text-sm font-semibold mt-4 mb-1" style="color:${Calc.CATEGORIES[c].color}">${Calc.CATEGORIES[c].label}</h4>
          <ul class="divide-y divide-slate-100 text-sm">${nw.assets.filter((a) => a.cat === c).map((a) => `<li class="py-2">
            <div class="flex justify-between gap-3"><span class="font-medium">${esc(a.label)}</span><span class="tabular-nums font-semibold whitespace-nowrap">${money(a.value)}</span></div>
            <p class="text-slate-500">${a.holders.map((h) => `${esc(memberName(h.member_id))} ${h.pct}%`).join(', ')}${detail(c, a.id) ? ' · ' + detail(c, a.id) : ''}</p></li>`).join('')}</ul>`).join('')}
      </section>`;
  }

  /* ---------- Membri ---------- */
  function renderMembers() {
    const nw = Calc.netWorth(D());
    return sectionHeader('Membrii familiei', 'Profilurile și drepturile de acces', 'family_members') +
      `<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">${D().family_members.map((m) => `<article class="card flex items-center gap-3">
        ${avatar(m)}
        <div class="flex-1 min-w-0"><p class="font-semibold truncate">${esc(m.name)}${m.id === state.profileId ? ' <span class="badge bg-teal-100 text-teal-800">tu</span>' : ''}</p>
        <p class="text-xs text-slate-500">${ROLE_LABELS[m.role] || esc(m.role)} · ${money(nw.byMember[m.id] || 0)}</p>
        <p class="text-xs mt-0.5 ${m.auth ? 'text-emerald-700' : 'text-slate-400'}">${m.auth ? '🔒 Protejat cu parolă' : 'Fără parolă'}</p></div>
        <button data-action="memberPassword" data-id="${esc(m.id)}" class="btn-ghost btn-sm" title="Parolă" aria-label="Parolă pentru ${esc(m.name)}">🔑</button>
        ${cardActions('family_members', m.id)}</article>`).join('')}</div>
      <div class="card mt-4 text-sm text-slate-600 space-y-1">${Object.keys(ROLE_LABELS).map((r) => `<p><strong>${ROLE_LABELS[r]}:</strong> ${ROLE_HINTS[r]}</p>`).join('')}</div>`;
  }

  /* ---------- Setări ---------- */
  function driveStatusHtml() {
    const s = state.sync.status;
    const connected = settings.driveConnected;
    const line = !connected ? '<span class="badge bg-slate-100 text-slate-600">Neconectat</span>'
      : DriveSync.hasValidToken() ? `<span class="badge bg-emerald-100 text-emerald-800">Conectat${settings.driveEmail ? ` ca ${esc(settings.driveEmail)}` : ''}</span>`
      : '<span class="badge bg-amber-100 text-amber-800">Sesiune expirată — reconectează</span>';
    return `<div class="flex flex-wrap items-center gap-2">${line}
      ${settings.lastSync ? `<span class="text-sm text-slate-500">Ultima sincronizare: ${new Date(settings.lastSync).toLocaleString('ro-RO')}</span>` : ''}
      ${s === 'error' && state.sync.message ? `<span class="text-sm text-rose-600">${esc(state.sync.message)}</span>` : ''}</div>`;
  }

  function renderSettings() {
    const rates = M().exchange_rates || {};
    return sectionHeader('Setări') + `
      <div class="grid gap-4 lg:grid-cols-2">
      <section class="card lg:col-span-2">
        <h3 class="font-semibold">☁️ Sincronizare Google Drive</h3>
        <p class="text-sm text-slate-500 mt-1">Fișierul <code>${DriveSync.FILE_NAME}</code> e salvat în folderul ascuns <code>appDataFolder</code>. Aplicația nu poate vedea alte fișiere din Drive.</p>
        <div id="drive-status" class="mt-3">${driveStatusHtml()}</div>
        <form data-form="clientId" class="mt-4 flex flex-col sm:flex-row gap-2">
          <input name="clientId" class="input flex-1 font-mono text-sm" placeholder="xxxxxxxx.apps.googleusercontent.com" value="${esc(settings.clientId || CONFIG.GOOGLE_CLIENT_ID)}" aria-label="Google OAuth Client ID">
          <button class="btn-secondary">Salvează Client ID</button>
        </form>
        <div class="flex flex-wrap gap-2 mt-3">
          <button data-action="connectDrive" class="btn-primary">${settings.driveConnected ? '🔄 Reconectează & sincronizează' : '🔗 Conectează Google Drive'}</button>
          ${settings.driveConnected ? `<button data-action="syncNow" class="btn-secondary">Sincronizează acum</button><button data-action="switchDriveAccount" class="btn-secondary">👤 Schimbă contul Google</button><button data-action="disconnectDrive" class="btn-ghost text-rose-600">Deconectează</button>` : ''}
        </div>
        <details class="mt-4 text-sm text-slate-600"><summary class="cursor-pointer font-medium">Cum obțin un Client ID?</summary>
          <ol class="list-decimal pl-5 mt-2 space-y-1">
            <li>Google Cloud Console → proiect nou → activează <strong>Google Drive API</strong>.</li>
            <li>OAuth consent screen → External → adaugă emailurile familiei la <em>Test users</em>.</li>
            <li>Scope: <code>https://www.googleapis.com/auth/drive.appdata</code></li>
            <li>Credentials → OAuth client ID → <em>Web application</em> → adaugă <code>${esc(location.origin)}</code> la <em>Authorized JavaScript origins</em>.</li>
          </ol>
          <p class="mt-2">Notă: <code>appDataFolder</code> aparține unui singur cont Google. Pentru a vedea aceleași date pe mai multe dispozitive, conectează-te cu același cont Google al familiei.</p>
        </details>
      </section>

      <section class="card">
        <h3 class="font-semibold">💱 Cursuri valutare</h3>
        <p class="text-sm text-slate-500 mt-1">Moneda de bază: <strong>${esc(baseCur())}</strong>. 1 unitate valută = X ${esc(baseCur())}.</p>
        <form data-form="rates" class="mt-3 space-y-2">
          ${Object.keys(rates).map((c) => `<div class="flex items-center gap-2"><span class="w-14 font-mono font-semibold">${esc(c)}</span>
            <input name="rate_${esc(c)}" type="number" step="any" min="0" value="${esc(rates[c])}" class="input flex-1">
            <button type="button" data-action="removeRate" data-cur="${esc(c)}" class="btn-ghost btn-sm text-rose-600" aria-label="Elimină ${esc(c)}">✕</button></div>`).join('')}
          <div class="flex items-center gap-2 pt-2 border-t border-slate-100"><input name="new_code" maxlength="3" placeholder="GBP" class="input w-20 uppercase font-mono"><input name="new_rate" type="number" step="any" min="0" placeholder="Curs" class="input flex-1"></div>
          <div class="flex justify-end"><button class="btn-primary btn-sm">Salvează cursurile</button></div>
        </form>
      </section>

      <section class="card">
        <h3 class="font-semibold">🔒 Parole pe profil</h3>
        <p class="text-sm text-slate-500 mt-1">Fiecare membru poate avea propria parolă, cerută la alegerea profilului. Parolele se sincronizează în Drive, deci sunt aceleași pe toate dispozitivele.</p>
        <p class="text-sm mt-2">${D().family_members.filter((m) => m.auth).length} din ${D().family_members.length} profiluri au parolă.</p>
        <p class="text-xs text-slate-400 mt-2">Parola blochează interfața; datele de pe dispozitiv nu sunt criptate.</p>
        <button data-action="nav" data-view="members" class="btn-secondary btn-sm mt-3">Gestionează parolele →</button>
      </section>

      <section class="card">
        <h3 class="font-semibold">🔐 Criptare date (parola familiei)</h3>
        ${FWVault.enabled() ? `<p class="text-sm mt-2"><span class="badge bg-emerald-100 text-emerald-800">✓ Activă</span>
            Datele sunt criptate (AES-256) pe acest dispozitiv, în Google Drive și în backupurile exportate.</p>
          <div class="flex flex-wrap gap-2 mt-3">
            <button data-action="lockNow" class="btn-secondary">🔒 Blochează acum</button>
            <button data-action="vaultChange" class="btn-secondary">Schimbă parola</button>
            <button data-action="vaultDisable" class="btn-ghost text-rose-600">Dezactivează</button>
          </div>`
        : `<p class="text-sm text-slate-500 mt-1">Criptează datele cu o parolă comună a familiei. Fără ea nimeni nu le poate citi — nici din Google Drive, nici de pe un laptop deblocat.</p>
          <p class="text-sm text-rose-700 mt-2">⚠️ Dacă uitați parola, datele nu mai pot fi recuperate.</p>
          <button data-action="vaultEnable" class="btn-primary mt-3">🔐 Activează criptarea</button>`}
      </section>

      <section class="card">
        <h3 class="font-semibold">🗂 Date</h3>
        <p class="text-sm text-slate-500 mt-1">Backup manual în format JSON (aceeași schemă ca în Google Drive).</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button data-action="exportJson" class="btn-secondary">⬇ Exportă JSON${FWVault.enabled() ? ' (criptat)' : ''}</button>
          ${FWVault.enabled() ? '<button data-action="exportPlain" class="btn-ghost">⬇ Exportă necriptat</button>' : ''}
          <button data-action="importJson" class="btn-secondary">⬆ Importă JSON</button>
          <input id="import-file" type="file" accept="application/json,.json" class="hidden">
        </div>
        <div class="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">
          <button data-action="loadDemo" class="btn-ghost btn-sm">Încarcă date demo</button>
          <button data-action="resetEmpty" class="btn-ghost btn-sm text-rose-600">Șterge toate datele</button>
        </div>
      </section>

      <section class="card">
        <h3 class="font-semibold">📲 Aplicație</h3>
        <p class="text-sm text-slate-500 mt-1">Funcționează offline după prima încărcare. Versiune schemă ${esc(M().version)}.</p>
        ${state.installPrompt ? '<button data-action="install" class="btn-primary mt-3">Instalează aplicația</button>'
          : '<p class="text-sm text-slate-500 mt-3">Pentru instalare: meniul browserului → „Adaugă pe ecranul principal” / „Instalează aplicația”.</p>'}
      </section>
      </div>`;
  }

  /* ======================================================================
     RENDER
     ====================================================================== */
  const VIEWS = {
    dashboard: renderDashboard, myassets: renderMyAssets, analysis: renderAnalysis,
    investments: renderInvestments, grandparents: renderGrandparents, realestate: renderRealEstate,
    children: renderChildren, vehicles: renderVehicles, guide: renderGuide, members: renderMembers, settings: renderSettings
  };

  function render() {
    const app = $('#app');
    const me = currentMember();
    if (!me) { app.innerHTML = renderProfilePicker(); return; }
    if (me.role === 'viewer_restricted') { app.innerHTML = renderChildMode(); return; }
    const allowed = (isAdmin() ? NAV_ADMIN : NAV_VIEWER).map((n) => n.id);
    if (!allowed.includes(state.view)) state.view = 'dashboard';
    const y = window.scrollY;
    app.innerHTML = renderShell(VIEWS[state.view]());
    window.scrollTo(0, y);
  }

  /* ======================================================================
     PROFILURI & PIN
     ====================================================================== */
  function setProfile(id) {
    state.profileId = id;
    try { id ? localStorage.setItem(LS.PROFILE, id) : localStorage.removeItem(LS.PROFILE); } catch (e) { /* ignore */ }
    const m = member(id);
    ssSet(SS_UNLOCK, m ? id : null);
    state.view = 'dashboard';
    window.scrollTo(0, 0);
    render();
    if (m && m.role === 'admin') setSync(state.sync.status, state.sync.message);
  }

  function selectProfile(id) {
    const m = member(id);
    if (!m) return;
    // Un admin deja autentificat poate deschide direct alt profil care NU e admin (ex. Modul Copil pentru demonstrație).
    const adminBypass = isAdmin() && m.role !== 'admin';
    if (m.auth && !adminBypass) {
      openModal({
        title: `Parola pentru ${m.name}`,
        body: `<div class="flex flex-col items-center gap-3">${avatar(m, 'w-14 h-14 text-xl')}
          <input type="text" name="username" value="${esc(m.name)}" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true">
          <input name="password" type="password" autocomplete="current-password" class="input text-center text-lg" aria-label="Parola" required></div>`,
        submitLabel: 'Intră',
        onSubmit: async (form) => {
          const btn = form.querySelector('[type=submit]');
          btn.disabled = true;
          const ok = await checkAuth(form.password.value, m.auth);
          if (!ok) {
            failedAttempts++;
            await new Promise((r) => setTimeout(r, Math.min(5000, 400 * failedAttempts))); // încetinește încercările repetate
            btn.disabled = false;
            showFormErrors([cryptoOk() ? 'Parolă incorectă.' : 'Browserul nu suportă verificarea parolei (este nevoie de HTTPS).']);
            form.password.value = ''; form.password.focus();
            return false;
          }
          failedAttempts = 0;
          closeModal(); setProfile(id); return true;
        }
      });
      return;
    }
    setProfile(id);
  }

  /** Setează / schimbă / elimină parola unui membru.
      Adminul poate reseta parola oricui fără parola veche; pentru propriul profil se cere parola curentă. */
  function passwordForm(memberId) {
    const m = member(memberId);
    if (!m) return;
    const self = memberId === state.profileId;
    if (!self && !isAdmin()) return;
    if (!cryptoOk()) { toast('Parolele necesită o conexiune securizată (HTTPS sau localhost).', 'error'); return; }
    const needCurrent = self && !!m.auth;
    openModal({
      title: `${m.auth ? 'Schimbă parola' : 'Setează parolă'} — ${m.name}`,
      body: `<div class="grid gap-3">
        <input type="text" name="username" value="${esc(m.name)}" autocomplete="username" class="hidden" tabindex="-1" aria-hidden="true">
        ${needCurrent ? `<label class="field"><span class="field-label">Parola curentă *</span><input name="current" type="password" autocomplete="current-password" class="input" required></label>` : ''}
        <label class="field"><span class="field-label">Parolă nouă *</span><input name="pw1" type="password" autocomplete="new-password" minlength="${MIN_PASSWORD}" class="input" required><span class="field-hint">Minim ${MIN_PASSWORD} caractere. Poate fi și un PIN numeric.</span></label>
        <label class="field"><span class="field-label">Confirmă parola *</span><input name="pw2" type="password" autocomplete="new-password" class="input" required></label>
        ${!self && m.auth ? '<p class="text-xs text-slate-500">Ca administrator, poți reseta parola fără s-o știi pe cea veche.</p>' : ''}
        ${m.auth ? `<button type="button" data-action="removePassword" data-id="${esc(m.id)}" class="btn-ghost btn-sm text-rose-600 justify-self-start">Elimină parola</button>` : ''}
      </div>`,
      onSubmit: async (form) => {
        const errors = [];
        if (needCurrent && !(await checkAuth(form.current.value, m.auth))) errors.push('Parola curentă este incorectă.');
        if (form.pw1.value.length < MIN_PASSWORD) errors.push(`Parola trebuie să aibă minim ${MIN_PASSWORD} caractere.`);
        if (form.pw1.value !== form.pw2.value) errors.push('Parolele nu coincid.');
        if (errors.length) { showFormErrors(errors); return false; }
        const auth = await makeAuth(form.pw1.value);
        commit((d) => { const t = d.family_members.find((x) => x.id === memberId); if (t) t.auth = auth; }, `Parola pentru ${m.name} a fost salvată.`);
        if (self) ssSet(SS_UNLOCK, memberId);
        return true;
      }
    });
  }

  async function removePassword(memberId) {
    const m = member(memberId);
    if (!m || !m.auth) return;
    const self = memberId === state.profileId;
    if (!self && !isAdmin()) return;
    if (self) {
      const form = $('[data-modal-form]');
      const cur = form && form.current ? form.current.value : '';
      if (!(await checkAuth(cur, m.auth))) { showFormErrors(['Introdu parola curentă ca să o elimini.']); return; }
    }
    closeModal();
    if (!(await confirmDialog('Elimină parola', `Profilul „${m.name}” va putea fi deschis fără parolă pe orice dispozitiv.`, 'Elimină'))) return;
    commit((d) => { const t = d.family_members.find((x) => x.id === memberId); if (t) delete t.auth; }, 'Parola a fost eliminată.');
  }

  /* ======================================================================
     ACȚIUNI
     ====================================================================== */
  async function exportJson(plain) {
    const encrypted = FWVault.enabled() && !plain;
    const payload = encrypted ? await FWVault.encrypt(D()) : D();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `family_wealth_data_${Calc.todayISO()}${encrypted ? '_criptat' : ''}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function replaceData(newData, msg) {
    state.data = normalizeData(newData);
    if (!currentMember() || !isAdmin()) {
      const admin = D().family_members.find((m) => m.role === 'admin');
      state.profileId = admin ? admin.id : null;
      try { localStorage.setItem(LS.PROFILE, state.profileId || ''); } catch (e) { /* ignore */ }
    }
    persist();
    render();
    toast(msg, 'success');
  }

  function contactForm(index) {
    const list = D().emergency_guide.trusted_contacts;
    const c = index != null ? list[index] : { name: '', phone: '', role: '' };
    openModal({
      title: index != null ? 'Editează contact' : 'Contact nou',
      body: `<div class="grid gap-3">
        <label class="field"><span class="field-label">Nume *</span><input name="name" class="input" value="${esc(c.name)}" required></label>
        <label class="field"><span class="field-label">Telefon</span><input name="phone" type="tel" class="input" value="${esc(c.phone)}"></label>
        <label class="field"><span class="field-label">Rol</span><input name="role" class="input" value="${esc(c.role)}" placeholder="Ex: Notar, Avocat, Consilier bancar"></label></div>`,
      onSubmit: (form) => {
        const v = { name: form.name.value.trim(), phone: form.phone.value.trim(), role: form.role.value.trim() };
        if (!v.name) { showFormErrors(['Numele este obligatoriu.']); return false; }
        commit((d) => { if (index != null) d.emergency_guide.trusted_contacts[index] = v; else d.emergency_guide.trusted_contacts.push(v); }, 'Contact salvat.');
        return true;
      }
    });
  }

  const actions = {
    nav: (ds) => { state.view = ds.view; window.scrollTo(0, 0); render(); },
    'nav-settings': () => { if (isAdmin()) { state.view = 'settings'; render(); } },
    add: (ds) => openForm(ds.collection),
    addChildInvestment: (ds) => { if (isAdmin()) openChildInvestmentPicker(ds.id); },
    pickChildInvestment: (ds) => {
      const o = childInvestmentOptions(ds.id)[+ds.index];
      if (!o || !isAdmin()) return;
      closeModal();
      openForm(o.c, null, o.preset);
    },
    edit: (ds) => openForm(ds.collection, ds.id),
    delete: (ds) => deleteItem(ds.collection, ds.id),
    closeModal: () => { const m = state.modal; closeModal(); if (m && m.onCancel) m.onCancel(); },
    switchProfile: () => setProfile(null),
    selectProfile: (ds) => selectProfile(ds.id),
    markPaid: (ds) => {
      const acc = D().children_savings.find((a) => a.id === ds.id);
      if (!acc || !isAdmin()) return;
      commit(() => {
        const amt = Calc.num(acc.monthly_contribution.target_amount);
        acc.current_balance = Calc.num(acc.current_balance) + amt;
        const g = acc.government_bonus_tracker;
        g.yearly_deposited = Calc.num(g.yearly_deposited) + amt;
        g.bonus_eligible = g.yearly_deposited >= (Calc.num(g.yearly_target) || 1200);
        acc.monthly_contribution.is_paid_this_month = true;
        acc.monthly_contribution.last_payment_date = Calc.todayISO();
        acc.tracker_year = new Date().getFullYear();
        pushHistory(acc);
      }, `+${money(acc.monthly_contribution.target_amount, acc.currency)} adăugat în contul lui ${memberName(acc.child_id)}.`);
    },
    addSplitRow: () => {
      const rows = $('#split-rows');
      const used = readSplits($('#modal-root')).map((s) => s.member_id);
      const next = D().family_members.find((m) => !used.includes(m.id)) || D().family_members[0];
      const remaining = Math.max(0, 100 - Calc.splitsTotal(readSplits($('#modal-root'))));
      rows.insertAdjacentHTML('beforeend', splitRowHtml({ member_id: next.id, percentage: remaining || '' }));
      updateSplitTotal();
    },
    removeSplitRow: (ds, el) => { el.closest('.split-row').remove(); updateSplitTotal(); },
    equalSplit: () => {
      const inputs = [...document.querySelectorAll('#split-rows [name=split_pct]')];
      Calc.equalSplit(inputs.length).forEach((v, i) => { inputs[i].value = v; });
      updateSplitTotal();
    },
    connectDrive: () => connectDrive(),
    switchDriveAccount: async () => {
      if (await confirmDialog('Schimbă contul Google', 'Alegi alt cont Google. Datele de pe acest dispozitiv vor fi înlocuite cu cele din Drive-ul contului ales (dacă există acolo).', 'Alege contul')) {
        connectDrive({ selectAccount: true });
      }
    },
    syncNow: () => runSync(),
    disconnectDrive: async () => { if (await confirmDialog('Deconectare Google Drive', 'Se deconectează doar acest dispozitiv. Datele rămân aici și în Drive, iar celelalte dispozitive rămân conectate.', 'Deconectează')) disconnectDrive(); },
    exportJson: () => exportJson(false),
    exportPlain: async () => {
      if (await confirmDialog('Export necriptat', 'Fișierul va conține toate datele în clar. Șterge-l după ce l-ai folosit.', 'Exportă necriptat')) exportJson(true);
    },
    lockNow: () => lockNow(),
    vaultEnable: () => vaultEnableForm(),
    vaultChange: () => vaultChangeForm(),
    vaultDisable: () => vaultDisableForm(),
    importJson: () => $('#import-file').click(),
    loadDemo: async () => {
      if (!(await confirmDialog('Încarcă date demo', 'Datele actuale de pe acest dispozitiv vor fi înlocuite cu cele demo (și sincronizate în Drive dacă e conectat).', 'Încarcă demo'))) return;
      replaceData(clone(DEMO_DATA), 'Date demo încărcate.');
    },
    resetEmpty: async () => {
      if (!(await confirmDialog('Șterge toate datele', 'Toate activele vor fi șterse de pe acest dispozitiv și, dacă Drive e conectat, și din Drive. Exportă un backup înainte!', 'Șterge tot'))) return;
      const d = emptyData();
      const me = currentMember();
      if (me) d.family_members = [{ id: me.id, name: me.name, role: 'admin' }];
      replaceData(d, 'Date resetate.');
    },
    removeRate: async (ds) => {
      const used = Calc.assets(D()).some((a) => a.currency === ds.cur);
      if (used) { toast(`${ds.cur} este folosit de unele active.`, 'error'); return; }
      commit((d) => { delete d.metadata.exchange_rates[ds.cur]; }, `${ds.cur} eliminat.`);
    },
    toggleMember: (ds) => updateAnalysis(() => toggleIn(analysis.members, ds.value)),
    allMembers: () => updateAnalysis(() => { analysis.members = []; }),
    toggleCat: (ds) => updateAnalysis(() => toggleIn(analysis.cats, ds.value)),
    allCats: () => updateAnalysis(() => { analysis.cats = []; }),
    setGroup: (ds) => updateAnalysis(() => { analysis.group = ds.value; }),
    resetAnalysis: () => updateAnalysis(() => { analysis.members = []; analysis.cats = []; }),
    drillMember: (ds) => updateAnalysis(() => { analysis.members = [ds.value]; analysis.group = 'category'; }),
    drillCategory: (ds) => updateAnalysis(() => { analysis.cats = [ds.value]; analysis.group = isAdmin() ? 'member' : 'list'; }),
    analyzeMember: (ds) => { analysis.members = [ds.value]; analysis.cats = []; analysis.group = 'category'; saveAnalysis(); state.view = 'analysis'; window.scrollTo(0, 0); render(); },
    sortList: (ds) => updateAnalysis(() => {
      if (analysis.sortKey === ds.value) analysis.sortDir = analysis.sortDir === 'asc' ? 'desc' : 'asc';
      else { analysis.sortKey = ds.value; analysis.sortDir = ds.value === 'value' ? 'desc' : 'asc'; }
    }),
    exportCsv,
    ownPassword: () => passwordForm(state.profileId),
    memberPassword: (ds) => passwordForm(ds.id),
    removePassword: (ds) => removePassword(ds.id),
    addContact: () => contactForm(null),
    editContact: (ds) => contactForm(+ds.index),
    deleteContact: async (ds) => {
      const c = D().emergency_guide.trusted_contacts[+ds.index];
      if (c && await confirmDialog('Șterge contact', `Ștergi contactul „${c.name}”?`)) commit((d) => { d.emergency_guide.trusted_contacts.splice(+ds.index, 1); }, 'Contact șters.');
    },
    print: () => window.print(),
    install: async () => {
      const p = state.installPrompt; if (!p) return;
      p.prompt(); await p.userChoice; state.installPrompt = null; render();
    }
  };

  const formHandlers = {
    unlock: async (form) => {
      const btn = form.querySelector('button'); const err = $('#unlock-error');
      btn.disabled = true; btn.textContent = 'Se verifică…'; err.textContent = '';
      let data = null;
      try { data = await FWVault.unlock(form.password.value, state.lockedEnvelope); } catch (e) { err.textContent = 'Browserul nu poate decripta datele (este nevoie de HTTPS).'; }
      if (!data) {
        failedAttempts++; await delay(Math.min(5000, 400 * failedAttempts));
        btn.disabled = false; btn.textContent = 'Deblochează';
        if (!err.textContent) err.textContent = 'Parolă greșită.';
        form.password.value = ''; form.password.focus();
        return;
      }
      failedAttempts = 0; state.lockedEnvelope = null;
      start(normalizeData(data));
    },
    guide: (form) => commit((d) => { d.emergency_guide.instructions = form.instructions.value; }, 'Instrucțiuni salvate.'),
    clientId: (form) => {
      settings.clientId = form.clientId.value.trim(); saveSettings();
      if (settings.clientId) DriveSync.preload();
      toast('Client ID salvat.', 'success'); render();
    },
    rates: (form) => {
      const rates = {};
      const errors = [];
      Object.keys(M().exchange_rates || {}).forEach((c) => {
        const v = parseFloat(form[`rate_${c}`].value);
        if (!(v > 0)) errors.push(`Curs invalid pentru ${c}.`); else rates[c] = v;
      });
      const code = form.new_code.value.trim().toUpperCase();
      if (code) {
        const v = parseFloat(form.new_rate.value);
        if (!/^[A-Z]{3}$/.test(code)) errors.push('Codul valutei trebuie să aibă 3 litere (ex: GBP).');
        else if (code === baseCur()) errors.push('Moneda de bază nu are nevoie de curs.');
        else if (!(v > 0)) errors.push(`Curs invalid pentru ${code}.`);
        else rates[code] = v;
      }
      if (errors.length) { toast(errors.join(' '), 'error', 5000); return; }
      commit((d) => { d.metadata.exchange_rates = rates; }, 'Cursuri actualizate.');
    }
  };

  /* ======================================================================
     EVENIMENTE
     ====================================================================== */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el.dataset, el, e); }
  });

  document.addEventListener('submit', async (e) => {
    const form = e.target;
    if (form.hasAttribute('data-modal-form')) {
      e.preventDefault();
      if (!state.modal || !state.modal.onSubmit) return;
      const res = await state.modal.onSubmit(form);
      if (res) closeModal();
      return;
    }
    const h = formHandlers[form.dataset.form];
    if (h) { e.preventDefault(); h(form); }
  });

  document.addEventListener('input', (e) => {
    if (e.target.closest('#split-rows')) updateSplitTotal();
    if (e.target.closest('#modal-root')) refreshDepositForm();
    if (e.target.id === 'analysis-search') { analysis.search = e.target.value; const box = $('#analysis-list'); if (box) box.innerHTML = listTableHtml(analysisRows()); }
  });
  document.addEventListener('change', (e) => {
    if (e.target.closest('#split-rows')) updateSplitTotal();
    if (e.target.closest('#modal-root')) refreshDepositForm();
    if (e.target.id === 'analysis-currency') updateAnalysis(() => { analysis.currency = e.target.value; });
    if (e.target.id === 'import-file') {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let parsed;
        try { parsed = JSON.parse(reader.result); } catch (err) { toast('Fișierul nu este un JSON valid.', 'error'); return; }
        const finish = async (data) => {
          if (!data || !data.metadata || !Array.isArray(data.family_members)) { toast('Structura fișierului nu corespunde schemei aplicației.', 'error'); return; }
          if (await confirmDialog('Importă date', `Datele actuale vor fi înlocuite cu cele din „${file.name}”.`, 'Importă')) replaceData(data, 'Date importate.');
        };
        if (!FWVault.isEnvelope(parsed)) { finish(parsed); return; }
        // Backup criptat: încearcă parola curentă, altfel cere parola acelui backup (fără s-o adopte)
        try { finish(await FWVault.decrypt(parsed)); return; } catch (err) { /* altă parolă */ }
        openModal({
          title: '🔒 Backup criptat',
          body: `<p class="text-sm text-slate-600 mb-3">„${esc(file.name)}” e criptat cu o altă parolă. Introdu parola cu care a fost exportat.</p>
            <input name="bkpw" type="password" autocomplete="off" class="input" aria-label="Parola backupului" required>`,
          submitLabel: 'Deschide',
          onSubmit: async (form) => {
            const data = await FWVault.open(form.bkpw.value, parsed);
            if (!data) { showFormErrors(['Parolă greșită.']); return false; }
            setTimeout(() => finish(data), 0);
            return true;
          }
        });
      };
      reader.readAsText(file);
    }
  });

  /* Dropdown cu sugestii (combo): la focus/▾ arată toate opțiunile; la tastare filtrează; se poate scrie și o valoare nouă. */
  const comboParts = (el) => { const box = el && el.closest('.combo'); return box ? { box, input: box.querySelector('[data-combo]'), menu: box.querySelector('.combo-menu') } : null; };
  function comboOpen(input, filter) {
    const { menu } = comboParts(input);
    const q = filter ? input.value.trim().toLowerCase() : '';
    const opts = (COMBO_LISTS[input.dataset.combo] || (() => []))().filter((o) => !q || o.toLowerCase().includes(q));
    if (!opts.length) { comboClose(input); return; }
    menu.innerHTML = opts.map((o) => `<li role="option" data-value="${esc(o)}" class="${o === input.value ? 'combo-sel' : ''}">${esc(o)}</li>`).join('');
    menu.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
  }
  function comboClose(input) {
    const { menu } = comboParts(input);
    menu.classList.add('hidden'); menu.innerHTML = '';
    input.setAttribute('aria-expanded', 'false');
  }
  const comboIsOpen = (input) => !comboParts(input).menu.classList.contains('hidden');
  document.addEventListener('focusin', (e) => { if (e.target.dataset && e.target.dataset.combo) comboOpen(e.target, false); });
  document.addEventListener('focusout', (e) => { if (e.target.dataset && e.target.dataset.combo) comboClose(e.target); });
  document.addEventListener('input', (e) => { if (e.target.dataset && e.target.dataset.combo) comboOpen(e.target, true); });
  document.addEventListener('mousedown', (e) => {
    const parts = comboParts(e.target);
    if (!parts) return;
    const li = e.target.closest('.combo-menu li');
    if (li) { e.preventDefault(); parts.input.value = li.dataset.value; comboClose(parts.input); refreshDepositForm(); return; }
    if (e.target === parts.input) { if (!comboIsOpen(parts.input)) comboOpen(parts.input, false); return; }
    if (e.target.closest('[data-combo-toggle]')) {
      e.preventDefault();
      if (document.activeElement !== parts.input) parts.input.focus(); // focusin deschide lista
      else if (comboIsOpen(parts.input)) comboClose(parts.input);
      else comboOpen(parts.input, false);
    }
  });
  document.addEventListener('keydown', (e) => {
    const input = e.target.dataset && e.target.dataset.combo ? e.target : null;
    if (!input) return;
    const { menu } = comboParts(input);
    const items = [...menu.querySelectorAll('li')];
    const cur = items.findIndex((li) => li.classList.contains('combo-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!comboIsOpen(input)) { comboOpen(input, false); return; }
      const next = items.length ? (cur + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length : -1;
      items.forEach((li, i) => li.classList.toggle('combo-active', i === next));
      if (items[next]) items[next].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && comboIsOpen(input) && cur >= 0) {
      e.preventDefault(); input.value = items[cur].dataset.value; comboClose(input); refreshDepositForm();
    } else if (e.key === 'Escape' && comboIsOpen(input)) {
      e.preventDefault(); comboClose(input);
    }
  }, true);

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.modal && !e.defaultPrevented) actions.closeModal(); });

  /* Tooltip la hover pentru orice element cu data-tip (bare, segmente, celule) */
  const tip = document.createElement('div');
  tip.className = 'viz-tip';
  tip.setAttribute('role', 'tooltip');
  document.body.appendChild(tip);
  const hideTip = () => { tip.style.opacity = '0'; };
  document.addEventListener('pointermove', (e) => {
    const t = e.target.closest && e.target.closest('[data-tip]');
    if (!t) { hideTip(); return; }
    tip.textContent = t.dataset.tip;
    tip.style.opacity = '1';
    const r = tip.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
    if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
    tip.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  });
  document.addEventListener('scroll', hideTip, { passive: true });
  document.addEventListener('pointerdown', (e) => { if (!(e.target.closest && e.target.closest('[data-tip]'))) hideTip(); });

  window.addEventListener('online', () => { if (settings.driveConnected) { if (pendingPush) pushNow(); else setSync(DriveSync.hasValidToken() ? 'synced' : 'auth'); } });
  window.addEventListener('offline', () => { if (settings.driveConnected) setSync('offline'); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; if (state.view === 'settings') render(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.data && applyRollovers(D())) { saveData(D()); render(); }
    if (document.visibilityState === 'visible' && state.data && settings.driveConnected && navigator.onLine && !pendingPush && !state.modal) {
      if (DriveSync.hasValidToken()) runSync(); else setSync('auth', 'Atinge pentru a sincroniza cu Google Drive');
    }
  });
  // Sincronizare între tab-uri deschise pe același dispozitiv
  window.addEventListener('storage', (e) => {
    if (e.key !== LS.DATA || !e.newValue || !state.data) return;
    try {
      const v = JSON.parse(e.newValue);
      if (FWVault.isEnvelope(v)) { if (FWVault.enabled()) FWVault.decrypt(v).then((d) => { state.data = normalizeData(d); render(); }).catch(() => {}); }
      else if (!FWVault.enabled()) { state.data = normalizeData(v); render(); }
    } catch (err) { /* ignore */ }
  });

  /* ======================================================================
     INIT
     ====================================================================== */
  async function init() {
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW:', err));
    }
    if (clientId() && navigator.onLine) DriveSync.preload();
    const stored = loadJSON(LS.DATA, null);
    if (FWVault.isEnvelope(stored)) {
      let data = null;
      if (await FWVault.restoreSession()) { try { data = await FWVault.decrypt(stored); } catch (e) { FWVault.lock(); } }
      if (!data) { showLockScreen(stored); return; }
      start(normalizeData(data));
      return;
    }
    start(stored ? normalizeData(stored) : demoData());
  }

  function start(data) {
    state.data = data;
    saveData(state.data);
    let pid = null;
    try { pid = localStorage.getItem(LS.PROFILE); } catch (e) { /* ignore */ }
    const m = pid && member(pid);
    // Profil cu parolă: o cere din nou la o sesiune nouă de browser
    state.profileId = m && (!m.auth || ssGet(SS_UNLOCK) === pid) ? pid : null;

    if (settings.driveConnected) {
      if (navigator.onLine && DriveSync.hasValidToken()) setTimeout(runSync, 300);
      else setSync(navigator.onLine ? 'auth' : 'offline', 'Atinge pentru a sincroniza cu Google Drive');
    }
    render();
  }

  init();
})();
