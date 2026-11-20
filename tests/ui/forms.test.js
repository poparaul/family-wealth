const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, wait } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');

const editCard = async (app, view, text) => {
  await app.nav(view);
  const card = app.qa('#app article.card').find((a) => a.textContent.includes(text));
  app.click(card.querySelector('[data-action="edit"]')); await wait(60);
  return app.modal();
};

test('dropdown-uri: închise la deschiderea formularului; click, ↓, tastare și Esc', async () => {
  const app = await boot({ data: makeFamily() });
  for (const [view, text] of [['investments', 'Trading 212'], ['grandparents', 'Raiffeisen']]) {
    await editCard(app, view, text);
    const first = app.q('#modal-root [data-combo]');
    const open = () => app.qa('#modal-root .combo-menu:not(.hidden)').length;
    assert.equal(open(), 0, `${view}: nimic deschis la editare`);
    app.mousedown(first); await wait(10);
    assert.equal(open(), 1);
    const li = app.q('#modal-root .combo-menu:not(.hidden) li'); app.mousedown(li); await wait(10);
    assert.equal(open(), 0); assert.equal(first.value, li.dataset.value);
    app.key(first, 'ArrowDown'); await wait(10); assert.equal(open(), 1);
    app.key(first, 'Escape'); await wait(10); assert.equal(open(), 0);
    assert.ok(app.modal(), 'Esc închide doar lista');
    first.value = 'rai'; first.dispatchEvent(new app.w.Event('input', { bubbles: true })); await wait(10);
    assert.ok(app.qa('#modal-root .combo-menu:not(.hidden) li').every((l) => l.textContent.toLowerCase().includes('rai')));
    app.click(app.q('#modal-root [data-action="closeModal"]')); await wait(20);
  }
});

test('investiție: câmpurile de cupon apar la titluri de stat, cele de depozit doar la depozite', async () => {
  const app = await boot({ data: makeFamily() });
  const f = await editCard(app, 'investments', 'Trading 212');
  const visible = (k) => !f.querySelector(`[data-path="${k}"]`).closest('[data-show-if]').classList.contains('hidden');
  assert.ok(!visible('interest_rate') && !visible('start_date'), 'acțiuni: ascunse');
  const type = f.querySelector('[data-path="account_type"]');
  type.value = 'Titluri de stat (Fidelis / Tezaur)'; type.dispatchEvent(new app.w.Event('input', { bubbles: true })); await wait(10);
  assert.ok(visible('interest_rate') && visible('maturity_date') && visible('tax_rate') && !visible('start_date'), 'titluri: cupon + scadență');
  type.value = 'Depozit la termen'; type.dispatchEvent(new app.w.Event('input', { bubbles: true })); await wait(10);
  assert.ok(visible('start_date') && visible('maturity_value'), 'depozit: toate câmpurile');
});

test('depozit bancar: nota se salvează și apare pe card', async () => {
  const app = await boot({ data: makeFamily() });
  const f = await editCard(app, 'grandparents', 'Revolut');
  f.querySelector('textarea[data-path="notes"]').value = 'Linia 1\nLinia 2';
  app.submit(f); await wait(50);
  assert.ok(app.q('p.whitespace-pre-line').textContent.includes('Linia 2'));
});

test('actualizare rapidă: salvează doar ce s-a schimbat, istoric la copii, intrări în jurnal', async () => {
  const app = await boot({ data: makeFamily(), profile: 'm_a' });
  await app.nav('update');
  const set = (id, v) => { app.q(`input[data-q][data-id="${id}"]`).value = v; };
  set('inv_t212', '31500'); set('child_k', '5100');
  app.submit(app.q('[data-form="quickUpdate"]')); await wait(50);
  const d = app.stored();
  assert.equal(d.investment_accounts.find((a) => a.id === 'inv_t212').total_value, 31500);
  assert.ok(d.investment_accounts.find((a) => a.id === 'inv_t212').updated_at);
  assert.ok(!d.investment_accounts.find((a) => a.id === 'inv_ibkr').updated_at, 'neschimbat → nemarcat');
  assert.equal(d.children_savings[0].balance_history.slice(-1)[0].balance, 5100);
  const log = d.changelog;
  assert.equal(log.length, 2);
  assert.ok(log.every((e) => e.by === 'Andrei' && e.action === 'edit'));
  assert.ok(log.some((e) => e.detail.includes('30.000 → 31.500')));
  await app.nav('settings');
  assert.ok(app.text().includes('Jurnal modificări') && app.text().includes('30.000 → 31.500'));
});

test('reînnoire depozit: dobânda capitalizată, termen nou, notă', async () => {
  const app = await boot({ data: makeFamily() });
  await app.nav('grandparents');
  const card = app.qa('#app article.card').find((a) => a.textContent.includes('Depozit la termen') && !a.textContent.includes('pe contul'));
  app.click(card.querySelector('[data-action="renewDeposit"]')); await wait(40);
  const f = app.modal();
  const expected = Math.round(parseFloat(f.principal.value));
  assert.ok(expected > 30000, 'sumă nouă = principal + dobândă netă');
  const oldEnd = makeFamily().grandparents_accounts[0].maturity_date;
  assert.equal(f.start.value, oldEnd);
  app.submit(f); await wait(50);
  const x = app.stored().grandparents_accounts.find((a) => a.id === 'bank_rf');
  assert.equal(Math.round(x.principal_amount), expected);
  assert.equal(x.start_date, oldEnd);
  assert.ok(x.maturity_date > oldEnd);
  assert.ok(x.notes.includes('Reînnoit'));
});

test('lista de active: sortare pe toate coloanele', async () => {
  const app = await boot({ data: makeFamily() });
  await app.nav('analysis');
  app.click(app.q('[data-action="setGroup"][data-value="list"]')); await wait(30);
  const col = (i) => app.qa('#analysis-list tbody tr').map((tr) => (i === 0 ? tr.children[0].querySelector('.font-medium') : tr.children[i]).textContent.trim());
  const sorted = (a) => a.every((x, i) => i === 0 || a[i - 1].localeCompare(x, 'ro', { sensitivity: 'base', numeric: true }) <= 0);
  assert.equal(app.qa('[data-action="sortList"]').length, 5);
  app.click(app.q('[data-action="sortList"][data-value="label"]')); await wait(20);
  assert.ok(sorted(col(0)));
  app.click(app.q('[data-action="sortList"][data-value="holders"]')); await wait(20);
  assert.ok(sorted(col(3)));
  assert.ok(app.q('th[aria-sort="ascending"] [data-value="holders"]'));
});
