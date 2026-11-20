const test = require('node:test');
const assert = require('node:assert/strict');
require('../../js/merge.js');
const { merge, stampChanges } = globalThis.FWMerge;
const { makeFamily } = require('../fixtures/family.js');
const clone = (x) => JSON.parse(JSON.stringify(x));
const inv = (d, id) => d.investment_accounts.find((a) => a.id === id);

test('modificări diferite pe două dispozitive se combină', () => {
  const base = makeFamily();
  const L = clone(base), R = clone(base);
  L.metadata.last_updated = new Date(Date.now() + 2000).toISOString();
  R.metadata.last_updated = new Date(Date.now() + 1000).toISOString();
  inv(L, 'inv_t212').total_value = 31000; inv(L, 'inv_t212').updated_at = L.metadata.last_updated;
  L.investment_accounts.push({ id: 'inv_new', platform: 'eToro', total_value: 1, currency: 'USD', splits: [] });
  L.investment_accounts = L.investment_accounts.filter((a) => a.id !== 'inv_xtb');
  L.metadata.exchange_rates.USD = 4.4;
  R.grandparents_accounts[0].interest_rate = 7;
  inv(R, 'inv_rev').notes = 'economii';
  R.metadata.exchange_rates.EUR = 5.2;
  R.emergency_guide.instructions = 'nou';
  const m = merge(base, L, R);
  assert.equal(inv(m.data, 'inv_t212').total_value, 31000);
  assert.ok(inv(m.data, 'inv_new'));
  assert.ok(!inv(m.data, 'inv_xtb'));
  assert.equal(m.data.grandparents_accounts[0].interest_rate, 7);
  assert.equal(inv(m.data, 'inv_rev').notes, 'economii');
  assert.deepEqual([m.data.metadata.exchange_rates.USD, m.data.metadata.exchange_rates.EUR], [4.4, 5.2]);
  assert.equal(m.data.emergency_guide.instructions, 'nou');
  assert.equal(m.conflicts.length, 0);
  assert.ok(m.changedLocal && m.changedRemote);
});

test('același cont: câmpuri diferite se combină, același câmp → câștigă cel mai recent', () => {
  const base = makeFamily();
  const L = clone(base), R = clone(base);
  inv(L, 'inv_t212').total_value = 1; inv(L, 'inv_t212').updated_at = '2026-01-01T12:00:00Z';
  inv(R, 'inv_t212').notes = 'x'; inv(R, 'inv_t212').updated_at = '2026-01-01T11:00:00Z';
  let m = merge(base, L, R);
  assert.equal(inv(m.data, 'inv_t212').total_value, 1);
  assert.equal(inv(m.data, 'inv_t212').notes, 'x');
  assert.equal(m.conflicts.length, 0);
  inv(R, 'inv_t212').total_value = 2;
  m = merge(base, L, R);
  assert.equal(inv(m.data, 'inv_t212').total_value, 1);
  assert.equal(m.conflicts.length, 1);
});

test('ștergeri: se aplică doar dacă celălalt dispozitiv nu a modificat contul', () => {
  const base = makeFamily();
  const L = clone(base), R = clone(base);
  L.investment_accounts = L.investment_accounts.filter((a) => a.id !== 'inv_rev');
  inv(R, 'inv_rev').total_value = 2000;
  assert.equal(inv(merge(base, L, R).data, 'inv_rev').total_value, 2000);
  const R2 = clone(base); R2.investment_accounts = R2.investment_accounts.filter((a) => a.id !== 'inv_t212');
  const m = merge(base, clone(base), R2);
  assert.ok(!inv(m.data, 'inv_t212'));
  assert.ok(!m.changedRemote && m.changedLocal);
});

test('nimic schimbat → nimic de urcat; colecțiile lipsă nu apar din senin', () => {
  const base = makeFamily();
  delete base.goals;
  const m = merge(base, clone(base), clone(base));
  assert.ok(!m.changedLocal && !m.changedRemote);
  assert.ok(!('goals' in m.data));
});

test('istoricul lunar și jurnalul nu generează conflicte vizibile', () => {
  const base = makeFamily();
  base.history = [{ id: '2026-01', total: 1 }];
  const L = clone(base), R = clone(base);
  L.history[0].total = 2; R.history[0].total = 3;
  assert.equal(merge(base, L, R).conflicts.length, 0);
});

test('stampChanges marchează doar conturile modificate sau adăugate', () => {
  const a = makeFamily(), b = clone(a);
  inv(b, 'inv_xtb').total_value = 999;
  b.vehicles.push({ id: 'v2', name: 'Nou' });
  b.history.push({ id: '2026-02', total: 1 });
  stampChanges(a, b, 'NOW');
  assert.equal(inv(b, 'inv_xtb').updated_at, 'NOW');
  assert.equal(b.vehicles[1].updated_at, 'NOW');
  assert.equal(inv(b, 'inv_t212').updated_at, undefined);
  assert.equal(b.history[0].updated_at, undefined);
});
