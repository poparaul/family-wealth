/* app.js — state management, randare UI și acțiuni */
(function () {
  'use strict';

  /* ======================================================================
     CONFIGURARE
     ====================================================================== */
  const CONFIG = {
    // Opțional: pune aici OAuth Client ID-ul ca să nu-l introduci manual pe fiecare dispozitiv.
    // Ex: '1234567890-abc.apps.googleusercontent.com'
    GOOGLE_CLIENT_ID: ''
  };

  const LS = { DATA: 'fw_data', PROFILE: 'fw_profile', SETTINGS: 'fw_settings' };
  const SS_UNLOCK = 'fw_admin_unlocked';

  const ROLE_LABELS = { admin: 'Administrator', viewer: 'Vizualizare', viewer_restricted: 'Modul Copil' };
  const ROLE_HINTS = {
    admin: 'Acces complet: editare, Google Drive, ghid de succesiune',
    viewer: 'Vede doar activele la care participă',
    viewer_restricted: 'Vede doar propria pușculiță'
  };
  const MEMBER_COLORS = ['#0d9488', '#6366f1', '#ec4899', '#f59e0b', '#0ea5e9', '#84cc16', '#a855f7', '#ef4444', '#14b8a6', '#64748b'];

  const NAV_ADMIN = [
    { id: 'dashboard', label: 'Panou', icon: '📊' },
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
    { id: 'myassets', label: 'Activele mele', icon: '📁' }
  ];

  const PLATFORMS = ['Tradeville', 'Interactive Brokers (IBKR)', 'CEC Bank', 'Banca Transilvania (BT)', 'BCR', 'BRD', 'ING Bank', 'Raiffeisen Bank', 'Titluri Tezaur', 'Fidelis', 'XTB', 'Revolut', 'Trezoreria Statului'];

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
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { v == null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } }

  async function hashPin(pin) {
    const text = 'fw-pin:' + pin;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0; for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
    return 'x' + (h >>> 0).toString(16);
  }

  /* ======================================================================
     STATE
     ====================================================================== */
  const settings = Object.assign(
    { clientId: '', driveConnected: false, adminPinHash: null, lastSync: null },
    loadJSON(LS.SETTINGS, {})
  );
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
  const memberColor = (id) => { const i = D().family_members.findIndex((m) => m.id === id); return i < 0 ? '#94a3b8' : MEMBER_COLORS[i % MEMBER_COLORS.length]; };
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

  function loadData() {
    const stored = loadJSON(LS.DATA, null);
    if (stored) return normalizeData(stored);
    const demo = normalizeData(clone(DEMO_DATA));
    saveJSON(LS.DATA, demo);
    setTimeout(() => toast('Au fost încărcate date demo. Le poți șterge din Setări → Date.', 'info', 6000), 600);
    return demo;
  }

  /** Salvare locală + auto-save Drive. */
  function persist() {
    M().last_updated = new Date().toISOString();
    saveJSON(LS.DATA, D());
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
      await DriveSync.push(D());
      pendingPush = false;
      settings.lastSync = new Date().toISOString(); saveSettings();
      setSync('synced');
    } catch (e) {
      setSync(e.status === 401 ? 'auth' : 'error', e.message);
    }
  }

  async function connectDrive() {
    if (!clientId()) {
      toast('Introdu întâi Google OAuth Client ID.', 'error');
      if (isAdmin()) { state.view = 'settings'; render(); }
      return;
    }
    if (!navigator.onLine) { toast('Ești offline. Conectarea la Drive necesită internet.', 'error'); return; }
    setSync('syncing', 'Autentificare…');
    try {
      await DriveSync.connect(clientId());
      settings.driveConnected = true; saveSettings();
      await runSync();
    } catch (e) {
      setSync(settings.driveConnected ? 'auth' : 'off', e.message);
      toast(e.message, 'error');
    }
  }

  async function runSync() {
    if (!DriveSync.hasValidToken()) return connectDrive();
    setSync('syncing');
    try {
      const res = await DriveSync.sync(D());
      if (res.action === 'pulled') {
        state.data = normalizeData(res.data);
        saveJSON(LS.DATA, state.data);
        if (!currentMember()) state.profileId = null;
        toast('Date actualizate din Google Drive.', 'success');
      } else if (res.action === 'pushed') {
        toast('Datele locale au fost salvate în Google Drive.', 'success');
      }
      pendingPush = false;
      settings.lastSync = new Date().toISOString(); saveSettings();
      setSync('synced');
      render();
    } catch (e) {
      setSync(e.status === 401 ? 'auth' : 'error', e.message);
      toast(e.message, 'error');
    }
  }

  function disconnectDrive() {
    DriveSync.disconnect();
    settings.driveConnected = false; settings.lastSync = null; saveSettings();
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
        { k: 'account_type', label: 'Tip cont / Instrumente', type: 'text' },
        { k: 'total_value', label: 'Valoare totală', type: 'number', req: true, min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        { k: 'notes', label: 'Note', type: 'textarea', wide: true }
      ]
    },
    grandparents_accounts: {
      singular: 'cont bancar', prefix: 'bank', splits: true,
      defaults: () => ({ bank_name: '', account_type: '', owner_id: firstByRole('viewer'), iban_or_account: '', principal_amount: 0, interest_rate: 0, maturity_date: null, currency: 'RON', splits: [] }),
      fields: [
        { k: 'bank_name', label: 'Bancă / Instituție', type: 'text', req: true, list: 'dl-platforms' },
        { k: 'account_type', label: 'Tip cont', type: 'text', placeholder: 'Ex: Depozit la termen (12 luni)' },
        { k: 'owner_id', label: 'Titular cont', type: 'member', req: true },
        { k: 'iban_or_account', label: 'IBAN / Nr. cont', type: 'text' },
        { k: 'principal_amount', label: 'Sumă (principal)', type: 'number', req: true, min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        { k: 'interest_rate', label: 'Dobândă anuală (%)', type: 'number', min: 0, max: 100 },
        { k: 'maturity_date', label: 'Data scadenței', type: 'date' }
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
        { k: 'account_type', label: 'Tip cont', type: 'text' },
        { k: 'iban', label: 'IBAN', type: 'text' },
        { k: 'current_balance', label: 'Sold curent', type: 'number', req: true, min: 0 },
        { k: 'currency', label: 'Monedă', type: 'currency', req: true },
        { type: 'section', label: 'Contribuție lunară' },
        { k: 'monthly_contribution.target_amount', label: 'Sumă lunară', type: 'number', min: 0 },
        { k: 'monthly_contribution.due_day', label: 'Ziua scadentă (1–28)', type: 'number', min: 1, max: 28, int: true },
        { k: 'monthly_contribution.is_paid_this_month', label: 'Alimentat luna aceasta', type: 'checkbox' },
        { type: 'section', label: 'Prima de stat (Cont Centenar)' },
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
        input = `<input ${common} type="text" value="${esc(v)}" ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''} ${f.list ? `list="${f.list}"` : ''} class="input">`;
    }
    return `<label class="field ${f.wide ? 'sm:col-span-2' : ''}" for="${id}">
      <span class="field-label">${esc(f.label)}${f.req ? ' <span class="text-rose-500">*</span>' : ''}</span>
      ${input}${f.hint ? `<span class="field-hint">${esc(f.hint)}</span>` : ''}</label>`;
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

  function openForm(collection, id) {
    const schema = SCHEMAS[collection];
    const existing = id ? D()[collection].find((x) => x.id === id) : null;
    if (id && !existing) return;
    const item = existing ? clone(existing) : schema.defaults();
    const body = `
      <datalist id="dl-platforms">${PLATFORMS.map((p) => `<option value="${esc(p)}">`).join('')}</datalist>
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
          <span class="text-xs text-slate-500">${ROLE_LABELS[m.role] || m.role}${m.role === 'admin' && settings.adminPinHash ? ' 🔒' : ''}</span>
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
      <div class="flex-1"><p class="font-medium">Scadență depozit — ${esc(a.bank_name)} (${esc(memberName(a.owner_id))})</p>
      <p class="text-sm">${money(a.principal_amount, a.currency)} · ${Calc.formatDate(a.maturity_date)} · <strong>${days < 0 ? `scadent de ${-days} zile` : Calc.formatDays(days)}</strong></p></div></div>`).join('');
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
          ${nw.total > 0 ? `<div class="flex h-3 rounded-full overflow-hidden mt-5 bg-white/10">${cats.map((c) => `<div title="${Calc.CATEGORIES[c].label}" style="width:${(nw.byCat[c] / nw.total) * 100}%;background:${Calc.CATEGORIES[c].color}"></div>`).join('')}</div>
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
        <h3 class="font-semibold mb-4">Defalcare pe membri (Account Splitting)</h3>
        <ul class="space-y-4">${members.map(({ m, v }) => `<li>
          <div class="flex items-center gap-3">${avatar(m, 'w-8 h-8 text-sm')}
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
            <div class="stat col-span-2"><dt>Scadență</dt><dd>${Calc.formatDate(a.maturity_date)} ${days != null ? `<span class="badge ${lvl ? LEVEL_BADGE[lvl] : 'bg-slate-100 text-slate-600'}">${days < 0 ? `scadent de ${-days} zile` : Calc.formatDays(days)}</span>` : ''}</dd></div>
            ${a.iban_or_account ? `<div class="stat col-span-2"><dt>IBAN / Cont</dt><dd class="font-mono text-xs break-all">${esc(a.iban_or_account)}</dd></div>` : ''}
          </dl>
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
  function childAccountCard(a, { kid = false } = {}) {
    const p = Calc.bonusProgress(a);
    const mc = a.monthly_contribution;
    const color = '#ec4899';
    const history = a.balance_history && a.balance_history.length ? a.balance_history : [{ date: Calc.todayISO(), balance: a.current_balance }];
    return `<article class="card ${kid ? 'p-6 sm:p-8' : ''}">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0"><h3 class="font-semibold ${kid ? 'text-xl' : 'text-lg'}">${kid ? '🐷 Pușculița mea' : esc(memberName(a.child_id))}</h3>
        <p class="text-sm text-slate-500">${esc(a.account_type)}${!kid && a.iban ? ` · <span class="font-mono text-xs">${esc(a.iban)}</span>` : ''}</p></div>
        ${kid ? '' : cardActions('children_savings', a.id)}
      </div>
      <p class="${kid ? 'text-5xl sm:text-6xl' : 'text-3xl'} font-bold mt-3 tabular-nums" style="color:${color}">${money(a.current_balance, a.currency)}</p>
      <div class="mt-5">
        <div class="flex justify-between text-sm mb-1.5"><span class="font-medium">${kid ? 'Drumul spre bonusul de la stat' : `Prag anual pentru prima de stat (${a.tracker_year || new Date().getFullYear()})`}</span><span class="tabular-nums">${money(p.deposited)} / ${money(p.target)}</span></div>
        ${progressBar(p.pct, p.eligible ? '#10b981' : color, kid ? 'h-6' : 'h-3')}
        <p class="text-sm mt-2 ${p.eligible ? 'text-emerald-700 font-medium' : 'text-slate-600'}">${p.eligible
          ? `🎉 ${kid ? 'Super! Vei primi' : 'Prag atins — eligibil pentru'} prima de ${money(p.bonus)}${kid ? ' de la stat!' : '.'}`
          : `${kid ? 'Mai trebuie' : 'Mai sunt necesari'} ${money(p.remaining)} ${kid ? 'ca să primești' : 'pentru prima de'} ${kid ? `${money(p.bonus)} cadou de la stat ✨` : money(p.bonus) + '/an.'}`}</p>
      </div>
      ${!kid ? `<div class="mt-4 flex flex-wrap items-center gap-3 text-sm border-t border-slate-100 pt-4">
        <span>Cotizație: <strong>${money(mc.target_amount, a.currency)}</strong> / lună, ziua ${mc.due_day}</span>
        ${mc.is_paid_this_month ? `<span class="badge bg-emerald-100 text-emerald-800">✓ Alimentat luna aceasta</span>` : `<span class="badge bg-amber-100 text-amber-800">Neachitat luna aceasta</span>`}
        ${mc.last_payment_date ? `<span class="text-slate-500">Ultima plată: ${Calc.formatDate(mc.last_payment_date)}</span>` : ''}
        ${!mc.is_paid_this_month && isAdmin() ? `<button data-action="markPaid" data-id="${esc(a.id)}" class="btn-primary btn-sm ml-auto">✓ Marchează ca alimentat</button>` : ''}
      </div>` : ''}
      <div class="mt-5"><p class="text-sm font-medium mb-2">${kid ? '📈 Cum a crescut pușculița' : 'Evoluția soldului'}</p>${lineChart(history, color)}</div>
    </article>`;
  }

  function renderChildren() {
    const list = D().children_savings;
    const kids = D().family_members.filter((m) => m.role === 'viewer_restricted');
    return sectionHeader('Economii Copii & Cont Centenar', 'Prag anual de 1.200 RON pentru prima de stat de 600 RON/an', 'children_savings') +
      (list.length ? `<div class="grid gap-4 lg:grid-cols-2">${list.map((a) => childAccountCard(a)).join('')}</div>` : emptyState('Niciun cont de economii pentru copii.', 'children_savings')) +
      (kids.length ? `<div class="card mt-4 flex flex-wrap items-center gap-3 no-print"><span class="text-2xl">🧒</span><div class="flex-1 min-w-[12rem]"><p class="font-medium">Modul Copil</p><p class="text-sm text-slate-500">Copilul vede doar propria pușculiță, fără parolă. ${settings.adminPinHash ? 'Revenirea la profilul de părinte cere PIN.' : 'Setează un PIN în Setări ca să protejezi profilul de părinte.'}</p></div>
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
      </main></div>`;
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
        <p class="text-xs text-slate-500">${ROLE_LABELS[m.role] || esc(m.role)} · ${money(nw.byMember[m.id] || 0)}</p></div>
        ${cardActions('family_members', m.id)}</article>`).join('')}</div>
      <div class="card mt-4 text-sm text-slate-600 space-y-1">${Object.keys(ROLE_LABELS).map((r) => `<p><strong>${ROLE_LABELS[r]}:</strong> ${ROLE_HINTS[r]}</p>`).join('')}</div>`;
  }

  /* ---------- Setări ---------- */
  function driveStatusHtml() {
    const s = state.sync.status;
    const connected = settings.driveConnected;
    const line = !connected ? '<span class="badge bg-slate-100 text-slate-600">Neconectat</span>'
      : DriveSync.hasValidToken() ? '<span class="badge bg-emerald-100 text-emerald-800">Conectat</span>'
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
          ${settings.driveConnected ? `<button data-action="syncNow" class="btn-secondary">Sincronizează acum</button><button data-action="disconnectDrive" class="btn-ghost text-rose-600">Deconectează</button>` : ''}
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
        <h3 class="font-semibold">🔒 PIN administrator</h3>
        <p class="text-sm text-slate-500 mt-1">Împiedică trecerea din Modul Copil / Vizualizare în profilul de părinte pe acest dispozitiv. Blochează doar interfața, nu criptează datele.</p>
        <form data-form="pin" class="mt-3 flex gap-2">
          <input name="pin" type="password" inputmode="numeric" minlength="4" maxlength="12" placeholder="${settings.adminPinHash ? 'PIN nou' : 'Minim 4 cifre'}" class="input flex-1" autocomplete="new-password">
          <button class="btn-primary">${settings.adminPinHash ? 'Schimbă' : 'Setează'}</button>
        </form>
        ${settings.adminPinHash ? '<button data-action="removePin" class="btn-ghost btn-sm text-rose-600 mt-2">Elimină PIN-ul</button>' : ''}
      </section>

      <section class="card">
        <h3 class="font-semibold">🗂 Date</h3>
        <p class="text-sm text-slate-500 mt-1">Backup manual în format JSON (aceeași schemă ca în Google Drive).</p>
        <div class="flex flex-wrap gap-2 mt-3">
          <button data-action="exportJson" class="btn-secondary">⬇ Exportă JSON</button>
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
    dashboard: renderDashboard, myassets: renderMyAssets,
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
    ssSet(SS_UNLOCK, m && m.role === 'admin' ? '1' : null);
    state.view = 'dashboard';
    window.scrollTo(0, 0);
    render();
    if (m && m.role === 'admin') setSync(state.sync.status, state.sync.message);
  }

  function selectProfile(id) {
    const m = member(id);
    if (!m) return;
    if (m.role === 'admin' && settings.adminPinHash && !(isAdmin())) {
      openModal({
        title: `PIN pentru ${m.name}`,
        body: `<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" class="input text-center text-2xl tracking-[0.5em]" aria-label="PIN">`,
        submitLabel: 'Deblochează',
        onSubmit: async (form) => {
          const ok = (await hashPin(form.pin.value)) === settings.adminPinHash;
          if (!ok) { showFormErrors(['PIN incorect.']); form.pin.value = ''; form.pin.focus(); return false; }
          closeModal(); setProfile(id); return true;
        }
      });
      return;
    }
    setProfile(id);
  }

  /* ======================================================================
     ACȚIUNI
     ====================================================================== */
  function exportJson() {
    const blob = new Blob([JSON.stringify(D(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `family_wealth_data_${Calc.todayISO()}.json`;
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
    syncNow: () => runSync(),
    disconnectDrive: async () => { if (await confirmDialog('Deconectare Google Drive', 'Datele rămân pe acest dispozitiv și în Drive, dar nu se vor mai sincroniza.', 'Deconectează')) disconnectDrive(); },
    exportJson,
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
    removePin: () => { settings.adminPinHash = null; saveSettings(); render(); toast('PIN eliminat.', 'info'); },
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
    },
    pin: async (form) => {
      const pin = form.pin.value.trim();
      if (!/^\d{4,12}$/.test(pin)) { toast('PIN-ul trebuie să conțină 4–12 cifre.', 'error'); return; }
      settings.adminPinHash = await hashPin(pin); saveSettings();
      render(); toast('PIN setat.', 'success');
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

  document.addEventListener('input', (e) => { if (e.target.closest('#split-rows')) updateSplitTotal(); });
  document.addEventListener('change', (e) => {
    if (e.target.closest('#split-rows')) updateSplitTotal();
    if (e.target.id === 'import-file') {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        let parsed;
        try { parsed = JSON.parse(reader.result); } catch (err) { toast('Fișierul nu este un JSON valid.', 'error'); return; }
        if (!parsed || !parsed.metadata || !Array.isArray(parsed.family_members)) { toast('Structura fișierului nu corespunde schemei aplicației.', 'error'); return; }
        if (await confirmDialog('Importă date', `Datele actuale vor fi înlocuite cu cele din „${file.name}”.`, 'Importă')) replaceData(parsed, 'Date importate.');
      };
      reader.readAsText(file);
    }
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.modal) actions.closeModal(); });

  window.addEventListener('online', () => { if (settings.driveConnected) { if (pendingPush) pushNow(); else setSync(DriveSync.hasValidToken() ? 'synced' : 'auth'); } });
  window.addEventListener('offline', () => { if (settings.driveConnected) setSync('offline'); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); state.installPrompt = e; if (state.view === 'settings') render(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.data && applyRollovers(D())) { saveJSON(LS.DATA, D()); render(); }
  });
  // Sincronizare între tab-uri deschise pe același dispozitiv
  window.addEventListener('storage', (e) => {
    if (e.key === LS.DATA && e.newValue) { try { state.data = normalizeData(JSON.parse(e.newValue)); render(); } catch (err) { /* ignore */ } }
  });

  /* ======================================================================
     INIT
     ====================================================================== */
  function init() {
    state.data = loadData();
    saveJSON(LS.DATA, state.data);
    let pid = null;
    try { pid = localStorage.getItem(LS.PROFILE); } catch (e) { /* ignore */ }
    const m = pid && member(pid);
    // Profil admin protejat de PIN: cere PIN din nou la o sesiune nouă de browser
    state.profileId = m && !(m.role === 'admin' && settings.adminPinHash && ssGet(SS_UNLOCK) !== '1') ? pid : null;

    if (settings.driveConnected) setSync(navigator.onLine ? 'auth' : 'offline', 'Atinge pentru a sincroniza cu Google Drive');
    if (clientId() && navigator.onLine) DriveSync.preload();
    render();

    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch((err) => console.warn('SW:', err));
    }
  }

  init();
})();
