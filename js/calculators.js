/* calculators.js — funcții pure: splitting, conversii valutare, zile rămase, alerte */
(function (global) {
  'use strict';

  const DOC_LABELS = { rca: 'RCA', rovinieta: 'Rovinietă', itp: 'ITP', casco: 'CASCO' };

  const CATEGORIES = {
    investment_accounts:   { label: 'Investiții',     color: '#0d9488' },
    grandparents_accounts: { label: 'Conturi bunici', color: '#6366f1' },
    real_estate:           { label: 'Imobiliare',     color: '#f59e0b' },
    children_savings:      { label: 'Economii copii', color: '#ec4899' },
    vehicles:              { label: 'Vehicule',       color: '#64748b' }
  };

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
      holders: fromSplits(a.splits)
    }));

    (data.grandparents_accounts || []).forEach((a) => out.push({
      cat: 'grandparents_accounts', id: a.id,
      label: [a.bank_name, a.account_type].filter(Boolean).join(' — '),
      value: toBase(a.principal_amount, a.currency, m), raw: num(a.principal_amount), currency: a.currency,
      holders: a.splits && a.splits.length ? fromSplits(a.splits) : one(a.owner_id)
    }));

    (data.real_estate || []).forEach((a) => {
      const share = num(a.share_percentage) / 100;
      out.push({
        cat: 'real_estate', id: a.id, label: a.title,
        value: toBase(num(a.estimated_value) * share, a.currency, m), raw: num(a.estimated_value) * share, currency: a.currency,
        holders: one(a.owner_id)
      });
    });

    (data.children_savings || []).forEach((a) => out.push({
      cat: 'children_savings', id: a.id, label: a.account_type,
      value: toBase(a.current_balance, a.currency, m), raw: num(a.current_balance), currency: a.currency,
      holders: one(a.child_id)
    }));

    (data.vehicles || []).forEach((a) => out.push({
      cat: 'vehicles', id: a.id, label: [a.name, a.plate_number].filter(Boolean).join(' · '),
      value: toBase(a.estimated_market_value, a.currency, m), raw: num(a.estimated_market_value), currency: a.currency,
      holders: one(a.owner_id)
    }));

    return out;
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

  function maturityAlerts(data, today = new Date(), within = 30) {
    return (data.grandparents_accounts || [])
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
    DOC_LABELS, CATEGORIES, DEFAULT_BONUS, num,
    baseCurrency, rateKnown, toBase,
    splitsTotal, validateSplits, equalSplit,
    todayISO, monthKey, parseDate, daysUntil, alertLevel,
    assets, netWorth, memberAssets,
    vehicleAlerts, childReminders, maturityAlerts,
    bonusProgress, vehicleAnnualCost, annualInterest,
    formatMoney, formatDate, formatDays
  };
})(window);
