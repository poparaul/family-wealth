const test = require('node:test');
const assert = require('node:assert/strict');
globalThis.window = globalThis;
require('../../js/calculators.js');
const Calc = globalThis.Calc;
const { makeFamily, addDays } = require('../fixtures/family.js');

test('depozit: dobândă brută, impozit 10%, valoare la scadență', () => {
  const r = Calc.depositReturn({ principal_amount: 10000, interest_rate: 6, start_date: '2026-01-01', maturity_date: '2027-01-01' });
  assert.equal(r.days, 365);
  assert.equal(Math.round(r.gross), 600);
  assert.equal(Math.round(r.net), 540);
  assert.equal(Math.round(r.value), 10540);
  const est = Calc.depositReturn({ principal_amount: 10000, interest_rate: 6, account_type: 'Depozit la termen (6 luni)' });
  assert.ok(est.estimated && est.days > 180 && est.days < 186);
  const manual = Calc.depositReturn({ total_value: 10000, interest_rate: 6, maturity_value: 10500 });
  assert.equal(Math.round(manual.net), 500);
});

test('tipuri: depozit vs titluri de stat', () => {
  assert.ok(Calc.isDeposit('Depozit la termen'));
  assert.ok(Calc.isBond('Titluri de stat (Fidelis / Tezaur)'));
  assert.ok(Calc.isBond('Fidelis 2036'));
  assert.ok(!Calc.isBond('Acțiuni'));
});

test('venituri pasive: dobânda depozitului la scadență și cuponul Fidelis', () => {
  const now = new Date();
  const d = makeFamily(now);
  const ev = Calc.incomeSchedule(d, now, 12);
  const dep = ev.find((e) => e.id === 'bank_rf' && e.kind === 'deposit');
  assert.ok(dep, 'dobânda Raiffeisen (scadență în 5 zile)');
  assert.equal(dep.date, addDays(now, 5));
  assert.equal(Math.round(dep.amount), Math.round(Calc.depositReturn(d.grandparents_accounts[0]).net));
  const coupons = ev.filter((e) => e.id === 'inv_fid_k' && e.kind === 'coupon');
  assert.equal(coupons.length, 1, 'un cupon pe an');
  assert.equal(coupons[0].amount, 6000 * 0.065, 'Fidelis: fără impozit');
  assert.ok(!ev.some((e) => e.id === 'inv_fid_c'), 'fără cupon dacă lipsesc dobânda/scadența');
  assert.ok(ev.every((e, i) => i === 0 || ev[i - 1].date <= e.date), 'sortate cronologic');
});

test('paleta pentru tema întunecată se comută în loc (culorile categoriilor o urmează)', () => {
  const light = Calc.CATEGORIES.investment_accounts.color;
  Calc.setDarkPalette(true);
  assert.notEqual(Calc.CATEGORIES.investment_accounts.color, light);
  assert.equal(Calc.PALETTE[0], Calc.CATEGORIES.investment_accounts.color);
  Calc.setDarkPalette(false);
  assert.equal(Calc.CATEGORIES.investment_accounts.color, light);
});

test('titluri de stat: profit până azi din cupon și zilele trecute (cupoane încasate + acumulat)', () => {
  const acc = { total_value: 10000, interest_rate: 6, start_date: '2025-03-01', maturity_date: '2028-03-01', tax_rate: 0 };
  const r = Calc.bondAccrued(acc, new Date(2026, 8, 1)); // 1 sept. 2026
  assert.equal(r.days, 549);
  assert.equal(Math.round(r.net), Math.round(10000 * 0.06 * 549 / 365)); // 902
  assert.equal(r.coupons, 1, 'cuponul din 1 martie 2026');
  assert.equal(Math.round(r.paid), 600);
  assert.equal(Math.round(r.accrued), 302);
  assert.equal(r.matured, false);
  // după scadență: se oprește la scadență
  const done = Calc.bondAccrued(acc, new Date(2030, 0, 1));
  assert.equal(done.matured, true);
  assert.equal(done.coupons, 3);
  assert.equal(Math.round(done.net), Math.round(10000 * 0.06 * done.days / 365));
  // impozit 10% (ex. obligațiuni corporative)
  assert.equal(Math.round(Calc.bondAccrued(Object.assign({}, acc, { tax_rate: 10 }), new Date(2026, 8, 1)).net), Math.round(902.47 * 0.9));
  assert.equal(Calc.bondAccrued(Object.assign({}, acc, { start_date: null })), null, 'fără data cumpărării: nu se calculează');
});
