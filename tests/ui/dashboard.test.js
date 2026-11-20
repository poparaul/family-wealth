const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, wait } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');

test('moneda de afișare: totalurile se convertesc, conturile rămân în moneda lor', async () => {
  const app = await boot({ data: makeFamily() });
  const hero = () => app.q('.text-4xl').textContent.replace(/\s/g, ' ').trim();
  const ron = hero();
  app.click(app.q('[data-action="setDisplayCurrency"][data-value="EUR"]')); await wait(20);
  assert.ok(/EUR|€/.test(hero()) && hero() !== ron);
  await app.nav('investments');
  assert.ok(app.text().includes('30.000 USD'));
  await app.nav('dashboard');
  app.click(app.q('[data-action="setDisplayCurrency"][data-value="RON"]')); await wait(20);
  assert.equal(hero(), ron);
});

test('grafic circular: sortare A→Z și grupare pe membri', async () => {
  const app = await boot({ data: makeFamily() });
  const legend = () => app.qa('.pie-wrap').length && app.qa('section.card ul.space-y-2 li span.truncate').map((s) => s.textContent);
  app.click(app.q('[data-action="setPieSort"][data-chart="dash"][data-value="name"]')); await wait(20);
  const names = legend();
  assert.deepEqual(names, names.slice().sort((a, b) => a.localeCompare(b, 'ro')));
  app.click(app.q('[data-action="setPieDim"][data-value="member"]')); await wait(20);
  assert.ok(legend().includes('Andrei'));
  assert.ok(app.qa('.pie-wrap path, .pie-wrap circle').every((p) => p.getAttribute('data-tip')));
});

test('evoluția averii: istoricul lunar + luna curentă, cu diferența față de luna trecută', async () => {
  const d = makeFamily();
  d.history = [{ id: '2020-01', total: 100000, byMember: { m_a: 50000 } }, { id: '2020-02', total: 200000, byMember: { m_a: 60000 } }];
  const app = await boot({ data: d });
  const card = app.qa('section.card').find((s) => s.textContent.includes('Evoluția'));
  assert.ok(card, 'cardul „Evoluția averii”');
  assert.equal(card.querySelectorAll('svg circle').length, 3, '2 luni salvate + luna curentă');
  assert.ok(card.textContent.includes('față de luna trecută'));
});

test('o salvare scrie fotografia lunii curente în istoric', async () => {
  const app = await boot({ data: makeFamily() });
  await app.nav('update');
  const input = app.q('input[data-q][data-id="inv_xtb"]');
  input.value = '250';
  app.submit(app.q('[data-form="quickUpdate"]')); await wait(50);
  const h = app.stored().history;
  const month = new Date().toISOString().slice(0, 7);
  assert.equal(h.length, 1);
  assert.equal(h[0].id.slice(0, 4), month.slice(0, 4));
  assert.ok(h[0].total > 0 && h[0].byMember.m_a > 0);
});

test('venituri pasive: dobânda depozitului și cuponul Fidelis apar pe luni', async () => {
  const app = await boot({ data: makeFamily() });
  const card = app.qa('section.card').find((s) => s.textContent.includes('Venituri pasive'));
  assert.ok(card);
  assert.ok(card.textContent.includes('Raiffeisen Bank'), 'dobânda depozitului cu scadență în 5 zile');
  assert.ok(card.textContent.includes('Tradeville'), 'cuponul Fidelis');
  // „Ale mele” (Mara nu e admin; folosim Ioana): Ioana nu are încasări cu dobândă completată în fereastră → doar depozitul ei
  const ioana = await boot({ data: makeFamily(), profile: 'm_i', settings: { mineOnly: true } });
  const c2 = ioana.qa('section.card').find((s) => s.textContent.includes('Venituri pasive'));
  assert.ok(c2.textContent.includes('pe contul lui Andrei'), 'depozitul Ioanei de pe contul lui Andrei');
  assert.ok(!c2.textContent.includes('Tradeville'), 'fără cuponul Marei');
});

test('obiective: adăugare cu conturi legate, progres și sumă lunară necesară', async () => {
  const app = await boot({ data: makeFamily() });
  app.click(app.q('[data-action="add"][data-collection="goals"]')); await wait(30);
  const f = app.modal();
  f.querySelector('[data-path="name"]').value = 'Facultate Mara';
  f.querySelector('[data-path="target_amount"]').value = '100000';
  f.querySelector('[data-path="deadline"]').value = `${new Date().getFullYear() + 10}-09-01`;
  f.querySelector('input[data-accounts][value="children_savings:child_k"]').checked = true;
  f.querySelector('input[data-accounts][value="grandparents_accounts:bank_bt_k"]').checked = true;
  app.submit(f); await wait(50);
  const g = app.stored().goals[0];
  assert.equal(g.name, 'Facultate Mara');
  assert.deepEqual(g.accounts.sort(), ['children_savings:child_k', 'grandparents_accounts:bank_bt_k']);
  const card = app.qa('section.card').find((s) => s.textContent.includes('Obiective'));
  assert.ok(card.textContent.includes('15%'), '15.000 din 100.000 RON');
  assert.ok(card.textContent.includes('/lună până la termen'));
});

test('crypto: categorie separată — tab propriu, card pe Panou, în grafic, analiză și ghid', async () => {
  const app = await boot({ data: makeFamily() });
  const cryptoCard = app.qa('button.card').find((b) => b.textContent.includes('Crypto'));
  assert.ok(cryptoCard && cryptoCard.textContent.includes('1 înregistrări'), 'card „Crypto” pe Panou');
  assert.ok(app.qa('.pie-wrap path, .pie-wrap circle').some((p) => p.getAttribute('data-tip').startsWith('Crypto')), 'felie „Crypto” în grafic');
  await app.nav('crypto');
  const titles = () => app.qa('#app article.card h3').map((h) => h.textContent);
  assert.deepEqual(titles(), ['Robinhood'], 'tab Crypto: doar conturile crypto');
  await app.nav('investments');
  assert.ok(!titles().includes('Robinhood'), 'tab Investiții: fără crypto');
  await app.nav('crypto');
  app.click(app.q('[data-action="addCrypto"]')); await wait(40);
  assert.ok(/Crypto/.test(app.modal().querySelector('[data-path="account_type"]').value), 'cont nou: tip Crypto precompletat');
  app.click(app.q('#modal-root [data-action="closeModal"]')); await wait(20);
  await app.nav('analysis');
  assert.ok(app.q('[data-action="toggleCat"][data-value="crypto"]'), 'filtru „Crypto” în analiză');
  await app.nav('guide');
  assert.ok(app.text().includes('Robinhood'), 'ghidul listează crypto fără erori');
  assert.equal(app.errors.length, 0, app.errors.join('; '));
});

test('ascunde sumele: 👁 din antet maschează sumele, păstrează procentele; calendarul are sumele reale', async () => {
  const app = await boot({ data: makeFamily() });
  const btn = () => app.q('header [data-action="toggleMask"]');
  assert.ok(btn(), 'butonul 👁 în antet');
  const hero = () => app.q('.text-4xl').textContent.trim();
  assert.match(hero(), /\d/);
  app.click(btn()); await wait(20);
  assert.ok(hero().startsWith('••••'), 'totalul e ascuns');
  const legend = app.qa('section.card ul.space-y-2 li').map((li) => li.textContent);
  assert.ok(legend.length && legend.every((t) => t.includes('••••') && /%/.test(t)), 'legenda: sume ascunse, procente vizibile');
  await app.nav('investments');
  assert.ok(!/30\.000/.test(app.text()), 'nicio sumă pe carduri');
  await app.nav('dashboard');
  app.click(app.q('[data-action="exportIcs"]')); await wait(30);
  const ics = await app.blobText(app.blobs[0]);
  assert.ok(/\d{1,3}(\.\d{3})+/.test(ics) && !ics.includes('••••'), 'fișierul .ics conține sumele reale');
  app.click(btn()); await wait(20);
  assert.match(hero(), /\d/, 'sumele reapar');
  assert.equal(app.settings().hideAmounts, false);
});

