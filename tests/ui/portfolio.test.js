const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, wait } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');

function withHoldings() {
  const d = makeFamily();
  const h = (symbol, qty, avg, price, currency) => ({ symbol, qty, avg, price, currency, value: price == null ? null : qty * price, cost: qty * avg });
  const t212 = d.investment_accounts.find((a) => a.id === 'inv_t212');
  t212.holdings = [h('NASDAQ:TSLA', 7, 200, 250, 'USD'), h('ETR:VWCE', 10, 100, 120, 'EUR')];
  t212.cash_amount = 50;
  const rev = d.investment_accounts.find((a) => a.id === 'inv_rev'); // al Ioanei
  rev.holdings = [h('NASDAQ:TSLA', 5, 260, 250, 'USD'), h('BVB:XYZ', 3, 1, null, 'RON')];
  return d;
}

test('portofoliu: același simbol la doi brokeri apare o dată, cu preț mediu ponderat și defalcare', async () => {
  const app = await boot({ data: withHoldings() });
  await app.nav('portfolio');
  const rows = app.qa('#app table.matrix tbody tr');
  const tsla = rows.find((r) => r.textContent.includes('NASDAQ:TSLA'));
  assert.equal(rows.length, 3, '3 simboluri (TSLA comasat)');
  assert.ok(tsla.textContent.includes('Trading 212 7') && tsla.textContent.includes('Revolut 5'), 'defalcare pe brokeri');
  assert.ok(tsla.children[1].textContent.trim() === '12', 'cantitate totală 12');
  assert.ok(tsla.children[2].textContent.includes('225'), 'preț mediu ponderat (7×200 + 5×260) / 12 = 225');
  assert.equal(rows[0].querySelector('td .font-medium').textContent, 'NASDAQ:TSLA', 'implicit: cea mai mare valoare prima');
  assert.equal(rows[rows.length - 1].querySelector('td .font-medium').textContent, 'BVB:XYZ', 'fără preț la final');
  const sections = app.qa('#app section.card h3').map((h) => h.textContent);
  assert.ok(sections.includes('Pe broker') && sections.includes('Pe monedă'));
  assert.ok(app.text().includes('Numerar în conturi'));
  app.click(app.q('[data-action="sortPortfolio"][data-value="symbol"]')); await wait(20);
  assert.equal(app.qa('#app table.matrix tbody tr')[0].querySelector('td .font-medium').textContent, 'BVB:XYZ', 'sortare A→Z');
  assert.equal(app.errors.length, 0, app.errors.join('; '));
});

test('portofoliu „Ale mele”: doar partea profilului curent', async () => {
  const app = await boot({ data: withHoldings(), profile: 'm_i', settings: { mineOnly: true } });
  await app.nav('portfolio');
  const rows = app.qa('#app table.matrix tbody tr');
  const tsla = rows.find((r) => r.textContent.includes('NASDAQ:TSLA'));
  assert.equal(tsla.children[1].textContent.trim(), '5', 'Ioana: doar cele 5 de la Revolut');
  assert.ok(!app.text().includes('ETR:VWCE'), 'fără deținerile lui Andrei');
});

test('portofoliu gol: trimite la Setări → Dețineri', async () => {
  const app = await boot({ data: makeFamily() });
  await app.nav('portfolio');
  assert.ok(app.text().includes('Încă nu există dețineri'));
});

test('grafice de profit: bare pe simbol (câștig/pierdere) și evoluția din fotografiile zilnice', async () => {
  const d = withHoldings();
  d.investment_accounts.find((a) => a.id === 'inv_rev').holdings[0].price = 240; // TSLA la Revolut: 5 × (240 − 260) = pierdere
  d.pf_history = [{ id: '2026-01-01', value: 1000, cost: 900, byMember: { m_a: { v: 800, c: 700 } } }, { id: '2026-01-02', value: 950, cost: 900, byMember: { m_a: { v: 760, c: 700 } } }];
  const app = await boot({ data: d });
  await app.nav('portfolio');
  const bars = app.qa('#app section.card').find((s) => s.textContent.includes('Profit pe simbol'));
  assert.ok(bars, 'graficul „Profit pe simbol”');
  const tips = [...bars.querySelectorAll('g[data-tip]')].map((g) => g.getAttribute('data-tip'));
  assert.ok(tips[0].startsWith('ETR:VWCE') || tips[0].startsWith('NASDAQ:TSLA'), 'cel mai mare câștig sus');
  assert.ok(!tips.some((t) => t.startsWith('BVB:XYZ')), 'fără preț → fără bară');
  const line = app.qa('#app section.card').find((s) => s.textContent.includes('Evoluția profitului'));
  assert.equal(line.querySelectorAll('svg circle').length, 2, '2 zile din istoric');
  // o salvare scrie fotografia de azi
  await app.nav('update');
  app.q('input[data-q][data-id="inv_xtb"]').value = '201';
  app.submit(app.q('[data-form="quickUpdate"]')); await wait(50);
  const h = app.stored().pf_history;
  assert.equal(h.length, 3);
  assert.ok(h[2].value > 0 && h[2].cost > 0 && h[2].byMember.m_a && h[2].byMember.m_i, 'total și pe membri');
});

test('graficul „Pe monedă”: fiecare felie în moneda ei, indiferent de moneda selectată sus', async () => {
  const d = withHoldings();
  Object.assign(d.investment_accounts.find((a) => a.id === 'inv_rev').holdings[1], { price: 10, value: 30 }); // BVB:XYZ 3 × 10 RON
  const app = await boot({ data: d });
  await app.nav('portfolio');
  app.click(app.q('[data-action="setDisplayCurrency"][data-value="EUR"]')); await wait(20);
  const card = app.qa('#app section.card').find((s) => s.querySelector('h3') && s.querySelector('h3').textContent === 'Pe monedă');
  const rows = [...card.querySelectorAll('ul li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim());
  const usd = rows.find((r) => r.startsWith('USD')), ron = rows.find((r) => r.startsWith('RON')), eur = rows.find((r) => r.startsWith('EUR'));
  assert.ok(usd && /3\.000 USD/.test(usd), `USD în dolari: ${usd}`);       // (7 + 5) × 250
  assert.ok(ron && /30 RON/.test(ron), `RON în lei: ${ron}`);
  assert.ok(eur && /1\.200 EUR/.test(eur), `EUR în euro: ${eur}`);
  const pct = rows.map((r) => parseFloat(r.match(/([\d.]+)%$/)[1]));
  assert.ok(Math.abs(pct.reduce((a, b) => a + b, 0) - 100) < 0.5, 'procentele însumează 100%');
});

test('„Pe broker”: o felie pe cont, fără gri; costul simbolurilor fără preț nu scade profitul', async () => {
  const d = withHoldings();
  d.investment_accounts.push({ id: 'inv_xtb_usd', platform: 'XTB', account_type: 'Acțiuni', total_value: 0, currency: 'USD', notes: '', splits: [{ member_id: 'm_a', percentage: 100 }],
    holdings: [{ symbol: 'NYSE:KO', qty: 10, avg: 60, price: 70, currency: 'USD', value: 700, cost: 600 }] });
  d.investment_accounts.find((a) => a.id === 'inv_xtb').holdings = [{ symbol: 'ETR:SAP', qty: 2, avg: 100, price: 150, currency: 'EUR', value: 300, cost: 200 }];
  const app = await boot({ data: d });
  await app.nav('portfolio');
  const card = app.qa('#app section.card').find((s) => s.querySelector('h3') && s.querySelector('h3').textContent === 'Pe broker');
  const labels = [...card.querySelectorAll('ul li span.truncate')].map((x) => x.textContent);
  assert.ok(labels.includes('XTB (USD)') && labels.includes('XTB (EUR)'), `felii separate: ${labels}`);
  const colors = [...card.querySelectorAll('ul li span.rounded-sm')].map((x) => x.getAttribute('style'));
  assert.ok(!colors.some((c) => c.includes('#8a8a86')), 'nicio felie gri (gri = „Alții”)');
  // BVB:XYZ (fără preț, cost 3 RON) nu intră în profit: profit total = suma profiturilor cu preț
  // profituri cu preț: TSLA 7×50 − 5×10 = 300 $, KO 100 $ → 400 $ × 4,5 = 1.800 lei; VWCE 200 €, SAP 100 € → 300 € × 5 = 1.500 lei
  const profit = app.qa('#app .card').find((c) => c.querySelector('p.text-xs') && c.querySelector('p.text-xs').textContent === 'Profit');
  assert.ok(profit.textContent.replace(/\s/g, ' ').includes('+3.300'), `profit total fără costul BVB:XYZ: ${profit.textContent}`);
});

test('portofoliu gol din cauza „Ale mele”: mesaj clar și buton pentru tot portofoliul familiei', async () => {
  const d = withHoldings();
  d.investment_accounts.find((a) => a.id === 'inv_rev').holdings = []; // Ioana nu are acțiuni
  const app = await boot({ data: d, profile: 'm_i', settings: { mineOnly: true } });
  await app.nav('portfolio');
  assert.ok(app.text().includes('Nu ai acțiuni în conturile tale'), 'mesaj clar');
  app.click(app.q('#app [data-action="toggleMine"]')); await wait(30);
  assert.ok(app.text().includes('NASDAQ:TSLA'), 'după buton: portofoliul familiei');
});

