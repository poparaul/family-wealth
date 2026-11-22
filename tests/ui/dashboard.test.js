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

test('panou: alertele și obiectivele sunt la final', async () => {
  const app = await boot({ data: makeFamily() });
  const titles = app.qa('#app section.card h3').map((h) => h.textContent.trim());
  const iAlerts = titles.findIndex((t) => t.startsWith('Alerte'));
  const iGoals = titles.findIndex((t) => t.includes('Obiective'));
  const iEvo = titles.findIndex((t) => t.includes('Evoluția'));
  assert.ok(iAlerts > iEvo && iGoals > iEvo, `ordine: ${titles.join(' | ')}`);
  assert.equal(Math.min(iAlerts, iGoals), titles.length - 2, 'ultimele două carduri');
});


test('bunicii nu intră în totalul de pe Panou; comutatorul „Include bunicii” îi adaugă; Analiza rămâne completă', async () => {
  const app = await boot({ data: makeFamily() });
  const num = (t) => parseFloat(t.replace(/[^\d]/g, ''));
  const hero = () => num(app.q('.text-4xl').textContent);
  const fam = app.w.Calc.netWorth(app.stored()).total;
  const bunica = 20000 * 5 * 0.85; // 85% din Fidelis-ul comun (20.000 EUR × 5)
  assert.ok(Math.abs(hero() - (fam - bunica)) <= 1, `fără Bunica Elena: ${hero()} vs ${fam - bunica}`);
  assert.ok(app.text().includes('fără Bunica Elena'));
  app.click(app.q('[data-action="toggleDashAll"]')); await wait(20);
  assert.ok(Math.abs(hero() - fam) <= 1, 'cu bunicii: totalul complet');
  app.click(app.q('[data-action="toggleDashAll"]')); await wait(20);
  await app.nav('analysis');
  assert.ok(app.text().includes('Bunica Elena'), 'Analiza îi include');
  await app.nav('members');
  const card = app.qa('#app [data-action="edit"][data-collection="family_members"]');
  app.click(card[0]); await wait(40);
  assert.equal(app.modal().querySelector('[data-path="in_family_total"]').checked, true, 'Andrei (admin): bifat implicit');
});

test('panou pe telefon: tile-urile pe categorii au lățime egală (2 coloane, butoane pe toată celula)', async () => {
  const app = await boot({ data: makeFamily() });
  const tiles = app.qa('#app section.grid button.card');
  assert.ok(tiles.length >= 5 && tiles.every((b) => b.classList.contains('w-full') && b.classList.contains('min-w-0')));
  assert.ok(tiles[0].parentElement.className.includes('grid-cols-2'));
});

test('Panou: categoria „Copii” = tot ce e pe numele copiilor, fără suprapuneri cu celelalte categorii', async () => {
  const app = await boot({ data: makeFamily(), settings: { dashIncludeAll: true } });
  const num = (t) => parseFloat(t.replace(/[^\d]/g, ''));
  const tiles = app.qa('#app section.grid button.card');
  const kid = tiles.find((b) => b.querySelector('span').textContent === 'Copii');
  assert.ok(kid, 'tile „Copii”');
  // Mara: Fidelis 6.000 EUR (30.000 RON) + BT economii 10.000 + Cont Centenar 5.000 = 45.000 RON
  assert.ok(kid.textContent.replace(/\s/g, ' ').includes('45.000'), kid.textContent);
  assert.ok(kid.textContent.includes('3 conturi pe numele lor'));
  const total = num(app.q('.text-4xl').textContent);
  const sumTiles = tiles.filter((b) => !b.hasAttribute('data-outside')).reduce((t, b) => t + num(b.querySelector('p').textContent), 0);
  assert.ok(Math.abs(sumTiles - total) <= tiles.length, `tile-urile adunate = totalul (${sumTiles} vs ${total})`);
  assert.ok(app.qa('.pie-wrap path, .pie-wrap circle').some((p) => p.getAttribute('data-tip').startsWith('Copii ·')), 'felie „Copii” în grafic');
  await app.nav('analysis');
  assert.ok(app.q('[data-action="toggleCat"][data-value="children_savings"]').textContent.includes('Economii copii'), 'Analiza păstrează categoriile clasice');
});

test('imobiliarele și vehiculele nu intră în avere: Panou, istoric, Membri; rămân în tile-uri și în Ghid', async () => {
  const d = makeFamily();
  d.real_estate = [{ id: 're_1', title: 'Apartament test', owner_id: 'm_a', share_percentage: 100, estimated_value: 500000, currency: 'RON' }];
  // fotografie veche (fără `fin`), cu imobiliare + vehicule incluse în total
  d.history = [{ id: '2020-01', total: 1000000, byMember: { m_a: 700000 }, byCat: { real_estate: 500000, vehicles: 40000 } }];
  const app = await boot({ data: d, settings: { dashIncludeAll: true } });
  const num = (t) => parseFloat(t.replace(/[^\d]/g, ''));
  const Calc = app.w.Calc;
  const all = Calc.assets(app.stored()).reduce((t, a) => t + a.value, 0);
  const fin = Calc.netWorth(app.stored()).total;
  assert.ok(Math.abs(all - fin - 540000) <= 1, 'netWorth fără apartament (500.000) și mașină (40.000)');
  assert.ok(Math.abs(num(app.q('.text-4xl').textContent) - fin) <= 1, 'Panou = averea financiară');
  const outside = app.qa('#app section.grid button.card[data-outside]');
  assert.equal(outside.length, 2, 'tile-uri Imobiliare + Vehicule');
  assert.ok(outside.every((b) => b.textContent.includes('în afara averii')));
  assert.ok(outside.some((b) => b.textContent.replace(/\s/g, ' ').includes('500.000')));
  // salvarea scrie fotografia lunii curente fără ele
  await app.nav('update');
  app.q('input[data-q][data-id="inv_xtb"]').value = '250';
  app.submit(app.q('[data-form="quickUpdate"]')); await app.wait(50);
  const cur = app.stored().history.find((h) => h.fin);
  assert.ok(cur && Math.abs(cur.total - Calc.netWorth(app.stored()).total) <= 1, JSON.stringify(cur));
  assert.equal(cur.byCat.real_estate, undefined);
  // fotografia veche e corectată în grafic: 1.000.000 − 540.000
  await app.nav('dashboard');
  const evo = app.qa('section.card').find((s) => s.textContent.includes('Evoluția'));
  const tip = evo.querySelector('svg circle title').textContent.replace(/\s/g, ' ');
  assert.ok(tip.includes('460.000'), tip);
  await app.nav('guide');
  assert.ok(app.text().includes('Apartament test') && app.text().includes('Dacia Logan'), 'Ghidul listează tot');
  assert.equal(app.errors.length, 0, app.errors.join('; '));
});
