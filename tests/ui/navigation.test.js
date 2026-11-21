const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, wait } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');

test('antet: numele vizibil, meniul de profil cu „Ale mele”, Setări, Blochează și Schimbă profilul', async () => {
  const app = await boot({ data: makeFamily() });
  assert.ok(app.q('header h1 + p').textContent.includes('Andrei'), 'numele utilizatorului în antet');
  const menu = () => app.q('header .user-menu');
  assert.ok(menu().classList.contains('hidden'), 'meniul e închis implicit');
  app.click(app.q('[data-action="toggleUserMenu"]')); await wait(20);
  assert.ok(!menu().classList.contains('hidden'), 'se deschide la click pe profil');
  const txt = menu().textContent;
  assert.ok(['Doar ale mele', 'Setări', 'Schimbă profilul', 'Ascunde sumele'].every((t) => txt.includes(t)), txt);
  app.click(menu().querySelector('[data-action="toggleMine"]')); await wait(20);
  assert.ok(app.text().includes('doar ale mele'), 'comutatorul funcționează din meniu');
  app.click(menu().querySelector('[data-view="settings"]')); await wait(20);
  assert.ok(menu().classList.contains('hidden'), 'navigarea închide meniul');
  assert.ok(app.text().includes('Cursuri valutare'), 'Setările s-au deschis');
});

test('telefon: bara de jos cu secțiunile principale + „Mai mult” cu restul', async () => {
  const app = await boot({ data: makeFamily() });
  const bottom = app.qa('nav.bottom-nav .bottom-item').map((b) => b.textContent.trim().replace(/\s+/g, ' '));
  assert.equal(bottom.length, 5);
  assert.ok(['Panou', 'Investiții', 'Analiză', 'Copii', 'Mai mult'].every((t, i) => bottom[i].includes(t)), bottom.join(' | '));
  app.click(app.q('[data-action="toggleMore"]')); await wait(20);
  const more = app.qa('.more-sheet .more-item').map((b) => b.textContent.trim());
  assert.ok(more.some((t) => t.includes('Bănci')) && more.some((t) => t.includes('Portofoliu')) && more.some((t) => t.includes('Actualizare')) && !more.some((t) => t.includes('Setări')), more.join(' | '));
  app.click(app.q('.more-sheet [data-view="grandparents"]')); await wait(20);
  assert.ok(!app.q('.more-sheet'), 'panoul se închide după alegere');
  assert.ok(app.q('nav.bottom-nav [data-action="toggleMore"]').textContent.includes('Bănci'), '„Mai mult” arată secțiunea curentă');
  app.click(app.q('[data-action="toggleMore"]')); await wait(20);
  app.click(app.q('.more-backdrop')); await wait(20);
  assert.ok(!app.q('.more-sheet'), 'click în afară închide panoul');
});

test('vizualizare: bara de jos fără „Mai mult”, meniul are 🔑 Parola mea și nu are Setări', async () => {
  const app = await boot({ data: makeFamily(), profile: 'm_g' });
  const bottom = app.qa('nav.bottom-nav .bottom-item');
  assert.equal(bottom.length, 3);
  assert.ok(!app.q('[data-action="toggleMore"]'));
  app.click(app.q('[data-action="toggleUserMenu"]')); await wait(20);
  const txt = app.q('header .user-menu').textContent;
  assert.ok(txt.includes('parol') && !txt.includes('Setări') && !txt.includes('Doar ale mele'));
});
