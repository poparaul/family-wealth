const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, wait } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');

test('criptare: activare, reguli de parolă, ecran de blocare, deblocare', async () => {
  const local = new Map();
  let app = await boot({ data: makeFamily(), local });
  assert.equal(app.errors.length, 0, app.errors.join('; '));
  await app.nav('settings');
  app.click(app.q('[data-action="vaultEnable"]')); await wait(30);
  const f = app.modal();
  for (const [pw, msg] of [['scurt1', 'minim 8'], ['doarlitere', 'litere și cifre'], ['12345678', 'litere și cifre']]) {
    f.pw1.value = pw; f.pw2.value = pw; f.ack.checked = true;
    app.submit(f); await wait(30);
    assert.ok(app.q('#form-errors').textContent.includes(msg), `refuză „${pw}”`);
  }
  f.pw1.value = 'Parola2026'; f.pw2.value = 'Parola2026';
  app.submit(f); await wait(2500);
  assert.equal(JSON.parse(local.get('fw_data')).fw_vault, 1, 'localStorage criptat');
  assert.ok(!local.get('fw_data').includes('Trading'));

  // sesiune nouă de browser → ecranul de blocare
  app = await boot({ local, profile: null, session: new Map() });
  const uf = app.named(app.q('[data-form="unlock"]'));
  assert.ok(uf, 'ecranul „Parola familiei”');
  assert.ok(!app.text().includes('Trading'), 'nicio dată vizibilă');
  uf.password.value = 'gresit123';
  app.submit(uf); await wait(2500);
  assert.ok(app.q('#unlock-error').textContent.includes('greșită'));
  uf.password.value = 'Parola2026';
  app.submit(uf); await wait(2500);
  assert.ok(!app.q('[data-form="unlock"]'), 'deblocat');
  assert.equal(app.errors.length, 0, app.errors.join('; '));
});

test('administrator: comutatorul „Ale mele” în antet; vizualizare: are 🔑', async () => {
  let app = await boot({ data: makeFamily(), profile: 'm_i' });
  const sw = () => app.q('header .mine-switch');
  assert.ok(sw() && !app.q('header [data-action="ownPassword"]'));
  app.click(sw()); await wait(20);
  assert.ok(app.text().includes('Averea ta (Ioana)'));
  await app.nav('grandparents');
  const banks = app.qa('#app article.card h3').map((h) => h.textContent);
  assert.deepEqual(banks.sort(), ['Raiffeisen Bank', 'Revolut'], 'depozitul pe contul lui Andrei apare la Ioana (banii ei)');
  await app.nav('investments');
  assert.ok(app.text().includes('Partea ta 15%'), 'cota din Fidelis-ul comun');
  app = await boot({ data: makeFamily(), profile: 'm_g' });
  assert.ok(app.q('header [data-action="ownPassword"]') && !app.q('header .mine-switch'));
  assert.ok(!app.q('header [data-view="settings"]'), 'vizualizare: fără Setări');
});

test('Setări: doar din rotița din antet (nu mai sunt în tab-uri)', async () => {
  const app = await boot({ data: makeFamily() });
  const gear = app.q('header > div [data-action="nav"][data-view="settings"]');
  assert.ok(gear, 'rotița ⚙️ în antet');
  app.click(gear); await wait(30);
  assert.ok(app.text().includes('Cursuri valutare'), 'deschide Setările');
  assert.ok(!app.q('nav[aria-label="Module"] [data-view="settings"]'), 'Setări nu mai e în tab-uri');
  assert.ok(app.q('header > div [data-view="settings"]'), 'rotița rămâne în antet și pe pagina Setări');
});
