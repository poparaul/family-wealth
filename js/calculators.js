/* calculators.js — funcții pure: splitting, conversii valutare, zile rămase, alerte */
(function (global) {
  'use strict';

  const DOC_LABELS = { rca: 'RCA', rovinieta: 'Rovinietă', itp: 'ITP', casco: 'CASCO' };

  // Paletă categorială validată (CVD-safe), ordine fixă — culoarea urmează entitatea, nu rangul.
  // Aceleași 8 nuanțe, alese separat pentru fundal deschis și întunecat (validate pentru daltonism și contrast).
  const PALETTE_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
  const PALETTE_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'];
  const PALETTE = PALETTE_LIGHT.slice();
  const OTHER_COLOR = '#8a8a86';

  const CATEGORIES = {
    investment_accounts:   { label: 'Investiții',     color: PALETTE[0] },
    grandparents_accounts: { label: 'Bănci & depozite', color: PALETTE[1] },
    real_estate:           { label: 'Imobiliare',     color: PALETTE[2] },
    children_savings:      { label: 'Economii copii', color: PALETTE[3] },
    vehicles:              { label: 'Vehicule',       color: PALETTE[4] }
  };
  const CAT_SLOT = { investment_accounts: 0, grandparents_accounts: 1, real_estate: 2, children_savings: 3, vehicles: 4 };
  /** Comută paleta (în loc) pentru tema întunecată; toate culorile derivate o urmează. */
  function setDarkPalette(on) {
    const src = on ? PALETTE_DARK : PALETTE_LIGHT;
    src.forEach((c, i) => { PALETTE[i] = c; });
    Object.keys(CAT_SLOT).forEach((k) => { CATEGORIES[k].color = PALETTE[CAT_SLOT[k]]; });
  }

  const DEFAULT_BONUS = 600;

  const num = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  };

  /* ---------- Valute ---------- */
  function baseCurrency(meta) { return (meta && meta.base_currency) || 'RON'; }

  function rateKnown(currency, meta) {
    if (!currency || currency === baseCurrency(meta)) return true;
    const r = meta && meta.exchange_rates && meta.exchange_rates[currency];
    return Number.isFinite(+r) && +r > 0;
  }

  /** Convertește o sumă în moneda de bază (RON). Monedele fără curs întorc 0. */
  function toBase(amount, currency, meta) {
    const a = num(amount);
    if (!currency || currency === baseCurrency(meta)) return a;
    return rateKnown(currency, meta) ? a * +meta.exchange_rates[currency] : 0;
  }

  /* ---------- Splitting ---------- */
  function splitsTotal(splits) {
    return Math.round((splits || []).reduce((s, x) => s + num(x.percentage), 0) * 100) / 100;
  }

  function validateSplits(splits) {
    const errors = [];
    if (!splits || !splits.length) { errors.push('Adaugă cel puțin un membru la împărțire.'); return errors; }
    const ids = splits.map((s) => s.member_id);
    if (new Set(ids).size !== ids.length) errors.push('Un membru apare de mai multe ori în împărțire.');
    if (splits.some((s) => num(s.percentage) <= 0 || num(s.percentage) > 100)) errors.push('Fiecare procent trebuie să fie între 0 și 100.');
    const t = splitsTotal(splits);
    if (Math.abs(t - 100) > 0.01) errors.push(`Suma procentelor este ${t}% — trebuie să fie exact 100%.`);
    return errors;
  }

  /** Împarte 100% egal la n membri, cu restul pe primul (2 zecimale). */
  function equalSplit(n) {
    if (n <= 0) return [];
    const each = Math.floor((100 / n) * 100) / 100;
    const out = Array(n).fill(each);
    out[0] = Math.round((100 - each * (n - 1)) * 100) / 100;
    return out;
  }

  /* ---------- Date ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function todayISO(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
  function monthKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

  function parseDate(str) {
    if (!str || typeof str !== 'string') return null;
    const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  }

  function daysUntil(str, today = new Date()) {
    const t = parseDate(str);
    if (!t) return null;
    const n = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.round((t - n) / 86400000);
  }

  /** galben < 30 zile, roșu < 7 zile, expirat < 0 */
  function alertLevel(days) {
    if (days == null) return null;
    if (days < 0) return 'expired';
    if (days < 7) return 'red';
    if (days < 30) return 'yellow';
    return null;
  }

  /* ---------- Active & Net Worth ---------- */
  /** Listă unificată de active, fiecare cu valoarea în RON și deținătorii (procent). */
  function assets(data) {
    const m = data.metadata || {};
    const out = [];
    const one = (id) => (id ? [{ member_id: id, pct: 100 }] : []);
    const fromSplits = (splits) => (splits || []).map((s) => ({ member_id: s.member_id, pct: num(s.percentage) }));

    (data.investment_accounts || []).forEach((a) => out.push({
      cat: 'investment_accounts', id: a.id,
      label: [a.platform, a.account_type].filter(Boolean).join(' — '),
      value: toBase(a.total_value, a.currency, m), raw: num(a.total_value), currency: a.currency,
      institution: a.platform || 'Necunoscut',
      holders: fromSplits(a.splits)
    }));

    (data.grandparents_accounts || []).forEach((a) => out.push({
      cat: 'grandparents_accounts', id: a.id,
      label: [a.bank_name, a.account_type].filter(Boolean).join(' — '),
      value: toBase(a.principal_amount, a.currency, m), raw: num(a.principal_amount), currency: a.currency,
      institution: a.bank_name || 'Necunoscut',
      holders: a.splits && a.splits.length ? fromSplits(a.splits) : one(a.owner_id)
    }));

    (data.real_estate || []).forEach((a) => {
      const share = num(a.share_percentage) / 100;
      out.push({
        cat: 'real_estate', id: a.id, label: a.title,
        value: toBase(num(a.estimated_value) * share, a.currency, m), raw: num(a.estimated_value) * share, currency: a.currency,
        institution: 'Proprietăți imobiliare',
        holders: one(a.owner_id)
      });
    });

    (data.children_savings || []).forEach((a) => out.push({
      cat: 'children_savings', id: a.id, label: a.account_type,
      value: toBase(a.current_balance, a.currency, m), raw: num(a.current_balance), currency: a.currency,
      institution: /trez/i.test(a.account_type || '') ? 'Trezoreria Statului' : (a.account_type || 'Economii copii'),
      holders: one(a.child_id)
    }));

    (data.vehicles || []).forEach((a) => out.push({
      cat: 'vehicles', id: a.id, label: [a.name, a.plate_number].filter(Boolean).join(' · '),
      value: toBase(a.estimated_market_value, a.currency, m), raw: num(a.estimated_market_value), currency: a.currency,
      institution: 'Autovehicule',
      holders: one(a.owner_id)
    }));

    out.forEach((a) => { if (!a.currency) a.currency = baseCurrency(m); });
    return out;
  }

  /** Un rând pentru fiecare (activ × deținător), plus partea nealocată. Baza pentru filtrare și grupare. */
  const UNALLOCATED = '__unallocated';
  function shareRows(data) {
    const rows = [];
    assets(data).forEach((a) => {
      const base = { assetId: a.id, cat: a.cat, label: a.label, institution: a.institution, currency: a.currency, assetValue: a.value };
      let alloc = 0;
      a.holders.forEach((h) => {
        alloc += h.pct;
        rows.push(Object.assign({}, base, { member_id: h.member_id, pct: h.pct, value: (a.value * h.pct) / 100 }));
      });
      if (alloc < 99.99) rows.push(Object.assign({}, base, { member_id: UNALLOCATED, pct: 100 - alloc, value: (a.value * (100 - alloc)) / 100 }));
    });
    return rows;
  }

  function netWorth(data) {
    const list = assets(data);
    const byMember = {};
    const byCat = {};
    let total = 0;
    let unallocated = 0;
    list.forEach((a) => {
      total += a.value;
      byCat[a.cat] = (byCat[a.cat] || 0) + a.value;
      let alloc = 0;
      a.holders.forEach((h) => {
        byMember[h.member_id] = (byMember[h.member_id] || 0) + (a.value * h.pct) / 100;
        alloc += h.pct;
      });
      if (alloc < 100) unallocated += (a.value * (100 - alloc)) / 100;
    });
    return { total, byMember, byCat, unallocated, assets: list };
  }

  /** Activele în care participă un membru, cu partea lui. */
  function memberAssets(data, memberId) {
    return assets(data)
      .map((a) => {
        const h = a.holders.find((x) => x.member_id === memberId);
        return h ? Object.assign({}, a, { pct: h.pct, share: (a.value * h.pct) / 100 }) : null;
      })
      .filter(Boolean);
  }

  /* ---------- Alerte ---------- */
  function vehicleAlerts(data, today = new Date()) {
    const out = [];
    (data.vehicles || []).forEach((v) => {
      const docs = v.documents || {};
      Object.keys(DOC_LABELS).forEach((k) => {
        const d = docs[k];
        if (!d || !d.expiration_date) return;
        const days = daysUntil(d.expiration_date, today);
        const level = alertLevel(days);
        if (level) out.push({ vehicle: v, doc: k, docLabel: DOC_LABELS[k], date: d.expiration_date, days, level });
      });
    });
    return out.sort((a, b) => a.days - b.days);
  }

  function childReminders(data, today = new Date()) {
    return (data.children_savings || [])
      .filter((a) => {
        const mc = a.monthly_contribution;
        return mc && !mc.is_paid_this_month && num(mc.target_amount) > 0 && today.getDate() >= (num(mc.due_day) || 1);
      })
      .map((a) => ({ account: a, daysLate: today.getDate() - (num(a.monthly_contribution.due_day) || 1) }));
  }

  /** Încasări în următoarele `months` luni: dobânzi la scadența depozitelor, cupoane anuale la titluri de stat
   *  (Fidelis/Tezaur: data cuponului = ziua și luna scadenței) și rambursarea principalului. Sume nete. */
  function incomeSchedule(data, from = new Date(), months = 12) {
    const m = data.metadata || {};
    const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
    const end = new Date(start); end.setMonth(end.getMonth() + months);
    const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const inWin = (d) => !!d && d >= start && d <= end;
    const holders = (a) => (a.splits && a.splits.length ? a.splits : a.owner_id ? [{ member_id: a.owner_id, percentage: 100 }] : []);
    const ev = [];
    const add = (a, col, d, amount, kind, label) => ev.push({ date: iso(d), amount, currency: a.currency, base: toBase(amount, a.currency, m), kind, label, id: a.id, col, holders: holders(a) });
    (data.grandparents_accounts || []).forEach((a) => {
      const d = parseDate(a.maturity_date);
      if (num(a.interest_rate) > 0 && inWin(d)) add(a, 'grandparents_accounts', d, depositReturn(a).net, 'deposit', [a.bank_name, a.account_type].filter(Boolean).join(' — '));
    });
    (data.investment_accounts || []).forEach((a) => {
      const d = parseDate(a.maturity_date);
      const label = [a.platform, a.account_type].filter(Boolean).join(' — ');
      if (isDeposit(a.account_type)) { if (num(a.interest_rate) > 0 && inWin(d)) add(a, 'investment_accounts', d, depositReturn(a).net, 'deposit', label); return; }
      if (!isBond(a.account_type) || !d) return;
      if (num(a.interest_rate) > 0) {
        const tax = a.tax_rate == null || a.tax_rate === '' ? 0 : num(a.tax_rate); // Fidelis/Tezaur: dobânzi neimpozabile
        const coupon = (num(a.total_value) * num(a.interest_rate) / 100) * (1 - tax / 100);
        for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
          const c = new Date(y, d.getMonth(), d.getDate());
          if (c > d) break;
          if (inWin(c)) add(a, 'investment_accounts', c, coupon, 'coupon', label);
        }
      }
      if (inWin(d)) add(a, 'investment_accounts', d, num(a.total_value), 'principal', label);
    });
    return ev.sort((x, y) => x.date.localeCompare(y.date) || x.kind.localeCompare(y.kind));
  }

  function maturityAlerts(data, today = new Date(), within = 30) {
    const invDeposits = (data.investment_accounts || []).filter((a) => isDeposit(a.account_type) && a.maturity_date)
      .map((a) => Object.assign({}, a, { bank_name: a.platform, principal_amount: a.total_value, owner_id: null }));
    return (data.grandparents_accounts || []).concat(invDeposits)
      .map((a) => ({ account: a, days: daysUntil(a.maturity_date, today) }))
      .filter((x) => x.days != null && x.days <= within)
      .sort((a, b) => a.days - b.days);
  }

  /* ---------- Module specifice ---------- */
  function bonusProgress(acc) {
    const g = acc.government_bonus_tracker || {};
    const target = num(g.yearly_target) || 1200;
    const deposited = num(g.yearly_deposited);
    return {
      target, deposited,
      remaining: Math.max(0, target - deposited),
      pct: Math.min(100, (deposited / target) * 100),
      eligible: deposited >= target,
      bonus: num(g.bonus_amount) || DEFAULT_BONUS
    };
  }

  function vehicleAnnualCost(v) {
    const d = v.documents || {};
    return ['rca', 'rovinieta', 'casco', 'itp'].reduce((s, k) => s + num(d[k] && d[k].cost), 0);
  }

  function annualInterest(acc) { return (num(acc.principal_amount) * num(acc.interest_rate)) / 100; }

  const DEFAULT_INTEREST_TAX = 10; // impozit pe dobânzi reținut la sursă (RO); editabil pe fiecare depozit
  const isDeposit = (type) => /depozit/i.test(type || '');
  const isBond = (type) => /titluri|fidelis|tezaur|obliga/i.test(type || '');

  // Randamentul unui depozit la termen: dobândă brută, impozit, dobândă netă și valoarea la scadență.
  // Perioada: data constituirii → scadență; altfel durata din tip („(6 luni)”); altfel 12 luni (estimare).
  function depositReturn(acc) {
    const principal = num(acc.principal_amount != null ? acc.principal_amount : acc.total_value);
    const rate = num(acc.interest_rate);
    const start = parseDate(acc.start_date), end = parseDate(acc.maturity_date);
    let days = null, estimated = false;
    if (start && end && end > start) days = Math.round((end - start) / 86400000);
    else {
      const m = String(acc.account_type || '').match(/(\d+)\s*(lun|lună|luna)/i);
      const months = m ? +m[1] : 12;
      days = Math.round((months * 365) / 12);
      estimated = true;
    }
    const taxPct = acc.tax_rate == null || acc.tax_rate === '' ? DEFAULT_INTEREST_TAX : num(acc.tax_rate);
    let gross = (principal * rate / 100) * days / 365;
    let tax = gross * taxPct / 100;
    let net = gross - tax;
    let value = principal + net;
    const manual = num(acc.maturity_value) > 0;
    if (manual) { value = num(acc.maturity_value); net = value - principal; gross = taxPct < 100 ? net / (1 - taxPct / 100) : net; tax = gross - net; }
    return { principal, rate, days, estimated, taxPct, gross, tax, net, value, manual };
  }

  /* ---------- Formatare ---------- */
  function formatMoney(v, cur = 'RON', decimals = 0) {
    try {
      return new Intl.NumberFormat('ro-RO', { style: 'currency', currency: cur || 'RON', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(num(v));
    } catch (e) {
      return `${new Intl.NumberFormat('ro-RO', { maximumFractionDigits: decimals }).format(num(v))} ${cur || ''}`.trim();
    }
  }

  function formatDate(str) {
    const d = parseDate(str);
    return d ? d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  }

  function formatDays(days) {
    if (days == null) return '';
    if (days < 0) return `expirat de ${-days} ${-days === 1 ? 'zi' : 'zile'}`;
    if (days === 0) return 'expiră azi';
    if (days === 1) return 'mâine';
    return `în ${days} zile`;
  }

  global.Calc = {
    DOC_LABELS, CATEGORIES, PALETTE, setDarkPalette, OTHER_COLOR, UNALLOCATED, DEFAULT_BONUS, num,
    baseCurrency, rateKnown, toBase, shareRows,
    splitsTotal, validateSplits, equalSplit,
    todayISO, monthKey, parseDate, daysUntil, alertLevel,
    assets, netWorth, memberAssets,
    vehicleAlerts, childReminders, maturityAlerts,
    bonusProgress, vehicleAnnualCost, annualInterest, depositReturn, isDeposit, isBond, incomeSchedule, DEFAULT_INTEREST_TAX,
    formatMoney, formatDate, formatDays
  };
})(window);
