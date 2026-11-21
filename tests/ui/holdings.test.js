const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, createDrive, wait } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');

const connected = { driveConnected: true, driveEmail: 'andrei@example.com', ratesAuto: false };
const acc = (app, id) => app.stored().investment_accounts.find((a) => a.id === id);

test('creează sheet-ul de dețineri: listă de brokeri, formule GOOGLEFINANCE, nume unice', async () => {
  const drive = createDrive();
  const app = await boot({ data: makeFamily(), drive, settings: connected });
  await app.nav('settings');
  app.click(app.q('[data-action="holdingsCreate"]')); await app.confirm(); await wait(300);
  const [id, sheet] = [...drive.st.sheets.entries()][0];
  const tab = sheet.body.sheets[0];
  assert.equal(tab.properties.title, 'Detineri');
  const rows = tab.data[0].rowData;
  assert.deepEqual(rows[0].values.slice(0, 4).map((v) => v.userEnteredValue.stringValue), ['Broker', 'Simbol (Google Finance)', 'Cantitate', 'Preț mediu']);
  const list = rows[1].values[0].dataValidation.condition.values.map((v) => v.userEnteredValue);
  assert.ok(list.includes('Trading 212') && list.includes('XTB') && list.includes('Robinhood'), `brokeri: ${list}`);
  assert.ok(!list.some((b) => /Raiffeisen|Tradeville/.test(b)), 'fără depozite / titluri de stat');
  assert.ok(rows[1].values[5].userEnteredValue.formulaValue.includes('GOOGLEFINANCE(B2)'));
  assert.equal(app.stored().metadata.holdings_sheet.id, id);
  assert.equal(acc(app, 'inv_t212').sheet_broker, 'Trading 212');
  await app.nav('settings');
  assert.ok(app.text().includes('Patrimoniu Familial – Dețineri'));
});

test('citire: valoarea contului din acțiuni (cu conversie) + numerar, avertismente, un singur rând în jurnal', async () => {
  const drive = createDrive();
  const data = makeFamily();
  data.metadata.holdings_sheet = { id: 'S99', name: 'Dețineri' };
  data.investment_accounts.find((a) => a.id === 'inv_t212').cash_amount = 100;
  drive.st.sheets.set('S99', { values: [
    ['Trading 212', 'NASDAQ:AAPL', 10, 150, 'USD', 200, 2000, 1500, 500, 0.33],
    ['Trading 212', 'ETR:VWCE', 5, 100, 'EUR', 120, 600, 500, 100, 0.2],
    ['Trading 212', 'XYZ:NOPE', 1, 1, '', '#N/A', '', 1, '', ''],
    ['Broker Necunoscut', 'NYSE:KO', 3, 60, 'USD', 70, 210, 180, 30, 0.16],
    ['XTB', 'LON:VUSA', 2, 5000, 'GBX', 6000, 12000, 10000, 2000, 0.2],
    ['', '', '', '', '', '', '', '', '', '']
  ] });
  const app = await boot({ data, drive, settings: connected });
  await app.nav('settings');
  app.click(app.q('[data-action="holdingsRead"]')); await wait(400);
  const t = acc(app, 'inv_t212');
  // 2000 USD + 600 EUR (= 3000 RON = 666,67 USD) + 100 USD numerar
  assert.equal(t.total_value, Math.round((2000 + (600 * 5) / 4.5 + 100) * 100) / 100);
  assert.equal(t.holdings.length, 3);
  assert.equal(t.holdings.find((h) => h.symbol === 'XYZ:NOPE').price, null);
  const x = acc(app, 'inv_xtb');
  assert.equal(x.total_value, 200, 'fără curs GBP: valoarea XTB nu se schimbă');
  assert.equal(x.holdings[0].price, 60, 'GBX → GBP (÷100)');
  const log = app.stored().changelog.filter((e) => e.label === 'Dețineri din Google Sheets');
  assert.equal(log.length, 1, 'un singur rând în jurnal');
  await app.nav('settings');
  assert.ok(app.text().includes('Broker Necunoscut') && app.text().includes('XYZ:NOPE') && app.text().includes('GBP'), 'avertismente');
  await app.nav('investments');
  let card = app.qa('#app article.card').find((a) => a.textContent.includes('Trading 212'));
  assert.ok(card.textContent.includes('3 poziții') && !card.textContent.includes('NASDAQ:AAPL'), 'lista e pliată implicit');
  assert.ok(card.textContent.includes('Numerar'));
  app.click(card.querySelector('[data-action="toggleHoldings"]')); await wait(20);
  card = app.qa('#app article.card').find((a) => a.textContent.includes('Trading 212'));
  assert.ok(card.textContent.includes('NASDAQ:AAPL') && card.textContent.includes('▲ 33.3%'), 'deschisă: simboluri și profit %');
  const order = () => [...app.qa('#app article.card').find((a) => a.textContent.includes('Trading 212')).querySelectorAll('tbody tr td:first-child')].map((td) => td.textContent);
  assert.deepEqual(order(), ['NASDAQ:AAPL', 'ETR:VWCE', 'XYZ:NOPE'], 'implicit: valoare de piață descrescător (în moneda de bază), fără preț la final');
  app.click(app.q('[data-action="sortHoldings"][data-value="symbol"]')); await wait(20);
  assert.deepEqual(order(), ['ETR:VWCE', 'NASDAQ:AAPL', 'XYZ:NOPE'], 'sortare după simbol A→Z');
  app.click(app.q('[data-action="sortHoldings"][data-value="pct"]')); await wait(20);
  assert.equal(order()[0], 'NASDAQ:AAPL', 'sortare după profit % (desc)');
  app.click(app.q('[data-action="sortHoldings"][data-value="value"]')); await wait(20);
  const n = app.stored().changelog.length;
  await app.nav('settings'); app.click(app.q('[data-action="holdingsRead"]')); await wait(300);
  assert.equal(app.stored().changelog.length, n, 'a doua citire fără schimbări → nimic nou');
});

test('nume personalizat în sheet + sumele ascunse în tabelul deținerilor', async () => {
  const drive = createDrive();
  const data = makeFamily();
  data.metadata.holdings_sheet = { id: 'S7', name: 'Dețineri' };
  data.investment_accounts.find((a) => a.id === 'inv_ibkr').sheet_broker = 'IBKR Andrei';
  drive.st.sheets.set('S7', { values: [['ibkr andrei', 'NASDAQ:MSFT', 4, 300, 'USD', 400]] });
  const app = await boot({ data, drive, settings: Object.assign({ hideAmounts: true }, connected) });
  await app.nav('settings'); app.click(app.q('[data-action="holdingsRead"]')); await wait(300);
  assert.equal(acc(app, 'inv_ibkr').total_value, 1600, 'potrivire fără diferențe de majuscule');
  await app.nav('investments');
  let card = app.qa('#app article.card').find((a) => a.textContent.includes('Interactive Brokers'));
  app.click(card.querySelector('[data-action="toggleHoldings"]')); await wait(20);
  card = app.qa('#app article.card').find((a) => a.textContent.includes('Interactive Brokers'));
  assert.ok(card.textContent.includes('NASDAQ:MSFT') && card.textContent.includes('••'), 'cantități și sume ascunse');
  assert.ok(!card.textContent.includes('1.600'));
  app.click(card.querySelector('[data-action="edit"]')); await wait(50);
  const f = app.modal();
  assert.ok(!f.querySelector('[data-path="sheet_broker"]').closest('[data-show-if]').classList.contains('hidden'), 'câmpul „Nume în sheet” la acțiuni');
});

test('diagnostic: brokeri scriși greșit → mesaj clar și rezumat în Setări', async () => {
  const drive = createDrive();
  const data = makeFamily();
  data.metadata.holdings_sheet = { id: 'S5', name: 'Dețineri' };
  drive.st.sheets.set('S5', { values: [['T212', 'NASDAQ:AAPL', 1, 1, 'USD', 2], ['T212', 'NYSE:KO', 1, 1, 'USD', 2]] });
  const app = await boot({ data, drive, settings: connected });
  await app.nav('settings'); app.click(app.q('[data-action="holdingsRead"]')); await wait(300);
  assert.ok(app.q('#toast-root').textContent.includes('Niciun broker din sheet nu se potrivește'), 'mesaj clar');
  assert.ok(app.text().includes('2 rânduri') && app.text().includes('T212'), 'rezumat + numele greșit în Setări');
});

test('analiză: tabelul membri × categorii e sortabil', async () => {
  const app = await boot({ data: makeFamily() });
  await app.nav('analysis');
  app.click(app.q('[data-action="setGroup"][data-value="matrix"]')); await wait(30);
  const names = () => app.qa('#app table.matrix tbody tr th').map((th) => th.textContent.trim());
  app.click(app.q('[data-action="sortMatrix"][data-value="name"]')); await wait(20);
  const n = names();
  assert.deepEqual(n, n.slice().sort((a, b) => a.localeCompare(b, 'ro')), 'după nume A→Z');
  app.click(app.q('[data-action="sortMatrix"][data-value="total"]')); await wait(20);
  assert.ok(app.q('th[aria-sort="descending"] [data-value="total"]'), 'după total, descrescător');
});

test('siguranță: dacă numele brokerului din sheet nu se mai potrivește, deținerile existente NU se golesc', async () => {
  const drive = createDrive();
  const data = makeFamily();
  data.metadata.holdings_sheet = { id: 'S3', name: 'Dețineri' };
  const x = data.investment_accounts.find((a) => a.id === 'inv_xtb');
  x.sheet_broker = 'XTB (EUR)';
  x.holdings = [{ symbol: 'LON:VUSA', qty: 2, avg: 50, price: 60, currency: 'EUR', value: 120, cost: 100 }];
  x.total_value = 120;
  drive.st.sheets.set('S3', { values: [['XTB EUR', 'LON:VUSA', 2, 50, 'EUR', 61]] }); // numele scris diferit
  const app = await boot({ data, drive, settings: connected });
  await app.nav('settings'); app.click(app.q('[data-action="holdingsRead"]')); await wait(300);
  const after = app.stored().investment_accounts.find((a) => a.id === 'inv_xtb');
  assert.equal(after.holdings.length, 1, 'deținerile au rămas');
  assert.equal(after.total_value, 120);
  assert.ok(app.text().includes('XTB EUR'), 'avertisment cu numele nepotrivit');
});

test('două conturi la același broker fără „Nume în sheet” salvat: potrivire după numele implicit (ex. XTB (USD))', async () => {
  const drive = createDrive();
  const data = makeFamily();
  data.metadata.holdings_sheet = { id: 'S4', name: 'Dețineri' };
  data.investment_accounts.push({ id: 'inv_xtb_usd', platform: 'XTB', account_type: 'Acțiuni', total_value: 0, currency: 'USD', notes: '', splits: [{ member_id: 'm_a', percentage: 100 }] });
  drive.st.sheets.set('S4', { values: [['XTB (USD)', 'NYSE:KO', 10, 60, 'USD', 70], ['XTB (EUR)', 'ETR:SAP', 2, 100, 'EUR', 150]] });
  const app = await boot({ data, drive, settings: connected });
  await app.nav('settings'); app.click(app.q('[data-action="holdingsRead"]')); await wait(300);
  assert.equal(acc(app, 'inv_xtb_usd').total_value, 700);
  assert.equal(acc(app, 'inv_xtb').total_value, 300);
  await app.nav('investments');
  const cards = app.qa('#app article.card').filter((a) => a.querySelector('h3').textContent === 'XTB');
  assert.ok(cards.some((c) => c.textContent.includes('În sheet: XTB (USD)')) && cards.some((c) => c.textContent.includes('În sheet: XTB (EUR)')), 'numele din sheet apare pe card');
});

test('numele implicite se salvează la citirea sheet-ului; formularul arată numele folosit când câmpul e gol', async () => {
  const drive = createDrive();
  const data = makeFamily();
  data.metadata.holdings_sheet = { id: 'S6', name: 'Dețineri' };
  data.investment_accounts.push({ id: 'inv_xtb_usd', platform: 'XTB', account_type: 'Acțiuni', total_value: 0, currency: 'USD', notes: '', splits: [{ member_id: 'm_a', percentage: 100 }] });
  drive.st.sheets.set('S6', { values: [['XTB (USD)', 'NYSE:KO', 1, 60, 'USD', 70]] });
  const app = await boot({ data, drive, settings: connected });
  await app.nav('investments');
  const card = app.qa('#app article.card').find((a) => a.textContent.includes('XTB') && a.textContent.includes('USD'));
  app.click(card.querySelector('[data-action="edit"]')); await wait(50);
  const field = app.modal().querySelector('[data-path="sheet_broker"]');
  assert.equal(field.value, '');
  assert.ok(/Implicit: XTB \((USD|EUR)\)/.test(field.placeholder), `placeholder: ${field.placeholder}`);
  app.click(app.q('#modal-root [data-action="closeModal"]')); await wait(20);
  await app.nav('settings'); app.click(app.q('[data-action="holdingsRead"]')); await wait(300);
  assert.equal(acc(app, 'inv_xtb_usd').sheet_broker, 'XTB (USD)', 'salvat explicit → se sincronizează');
  assert.equal(acc(app, 'inv_xtb').sheet_broker, 'XTB (EUR)');
  assert.equal(acc(app, 'inv_t212').sheet_broker, 'Trading 212');
});

