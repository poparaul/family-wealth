const test = require('node:test');
const assert = require('node:assert/strict');
const { boot, createDrive, wait, clone } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');

const connected = { driveConnected: true, driveEmail: 'andrei@example.com', ratesAuto: false };

test('salvarea automată îmbină: modificarea de pe alt dispozitiv nu se pierde', async () => {
  const drive = createDrive();
  const data = makeFamily();
  const id = drive.put(data);
  const app = await boot({ data, drive, settings: connected, base: data });
  await wait(800);
  const remote = drive.json(id);
  remote.grandparents_accounts[0].interest_rate = 7.25;
  remote.metadata.last_updated = new Date().toISOString();
  drive.st.files.get(id).content = JSON.stringify(remote);
  await app.nav('update');
  app.q('input[data-q][data-id="inv_t212"]').value = '32000';
  app.submit(app.q('[data-form="quickUpdate"]')); await wait(3000);
  const now = drive.json(id);
  assert.equal(now.investment_accounts.find((a) => a.id === 'inv_t212').total_value, 32000);
  assert.equal(now.grandparents_accounts[0].interest_rate, 7.25);
  assert.equal(app.stored().grandparents_accounts[0].interest_rate, 7.25);
  assert.ok(app.q('#toast-root').textContent.includes('combinate'));
  assert.equal(app.errors.length, 0, app.errors.join('; '));
});

test('fișier partajat: cere criptare, se creează criptat, partajare, sincronizare, revenire', async () => {
  const drive = createDrive();
  const data = makeFamily();
  drive.put(data);
  const app = await boot({ data, drive, settings: connected, base: data });
  await wait(800);
  await app.nav('settings');
  assert.ok(app.q('[data-action="sharedCreate"]').disabled, 'fără criptare: dezactivat');
  app.click(app.q('[data-action="vaultEnable"]')); await wait(30);
  const f = app.modal(); f.pw1.value = 'Parola2026'; f.pw2.value = 'Parola2026'; f.ack.checked = true;
  app.submit(f); await wait(2500);
  await app.nav('settings');
  app.click(app.q('[data-action="sharedCreate"]')); await app.confirm(); await wait(1500);
  const shared = [...drive.st.files.values()].find((x) => !x.appdata);
  assert.ok(shared && JSON.parse(shared.content).fw_vault === 1 && !shared.content.includes('Andrei'), 'vizibil în Drive, criptat');
  assert.equal(app.settings().driveMode, 'shared');
  await wait(400);
  const share = app.modal();
  share.email.value = 'ioana@example.com'; app.submit(share); await wait(300);
  assert.ok(drive.st.perms.get(shared.id).some((p) => p.emailAddress === 'ioana@example.com' && p.role === 'writer'));
  const appBefore = drive.appFile().content;
  await app.nav('update');
  app.q('input[data-q][data-id="inv_xtb"]').value = '333';
  app.submit(app.q('[data-form="quickUpdate"]')); await wait(3500);
  assert.equal(drive.appFile().content, appBefore, 'folderul privat nu mai e folosit');
  assert.ok(drive.st.calls.some((c) => c.startsWith('PATCH') && c.includes(`/files/${shared.id}?`)), 'salvat în fișierul partajat');
  await app.nav('settings');
  app.click(app.q('[data-action="sharedLeave"]')); await app.confirm(); await wait(3500);
  assert.equal(app.settings().driveMode, 'appdata');
  assert.notEqual(drive.appFile().content, appBefore);
});

test('backup-uri: creare automată după sincronizare, listare și restaurare', async () => {
  const drive = createDrive();
  const data = makeFamily();
  drive.put(data);
  const app = await boot({ data, drive, settings: connected, base: data });
  await app.nav('settings');
  app.click(app.q('[data-action="syncNow"]')); await wait(1500);
  assert.equal(drive.backups().length, 1, 'primul backup după sincronizare');
  await app.nav('update');
  app.q('input[data-q][data-id="inv_t212"]').value = '1'; app.submit(app.q('[data-form="quickUpdate"]')); await wait(2500);
  await app.nav('settings');
  app.click(app.q('[data-action="backupList"]')); await wait(200);
  const btn = app.q('#backup-list [data-action="backupRestore"]');
  assert.ok(btn, 'backup listat');
  app.click(btn); await app.confirm(); await wait(300);
  assert.equal(app.stored().investment_accounts.find((a) => a.id === 'inv_t212').total_value, 30000, 'restaurat');
});

test('cursuri BCE: actualizare automată pentru administratori', async () => {
  const drive = createDrive({ rates: { RON: 5.1, USD: 1.2 } });
  const app = await boot({ data: makeFamily(), drive, settings: { ratesAuto: true } });
  await wait(1200);
  const r = app.stored().metadata;
  assert.equal(r.exchange_rates.EUR, 5.1);
  assert.equal(r.exchange_rates.USD, Math.round((5.1 / 1.2) * 10000) / 10000);
  assert.equal(r.rates_source, 'BCE');
  assert.ok(app.stored().changelog.some((e) => e.collection === 'rates'));
});

test('export calendar .ics: scadențe, cupoane, documente auto, cu alarme', async () => {
  const app = await boot({ data: makeFamily() });
  app.click(app.q('[data-action="exportIcs"]')); await wait(30);
  const ics = await app.blobText(app.blobs[0]);
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.includes('Scadență depozit Raiffeisen Bank'));
  assert.ok(ics.includes('Cupon Tradeville'));
  assert.ok(ics.includes('RCA — Dacia Logan'));
  assert.ok(ics.includes('TRIGGER:-P7D'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, (ics.match(/END:VEVENT/g) || []).length);
});

test('temă: întunecat / luminos / automat + paleta graficelor', async () => {
  const app = await boot({ data: makeFamily() });
  await app.nav('settings');
  const light = app.w.Calc.CATEGORIES.investment_accounts.color;
  app.click(app.q('[data-action="setTheme"][data-value="dark"]')); await wait(20);
  assert.equal(app.doc.documentElement.getAttribute('data-theme'), 'dark');
  assert.notEqual(app.w.Calc.CATEGORIES.investment_accounts.color, light);
  assert.equal(app.settings().theme, 'dark');
  app.click(app.q('[data-action="setTheme"][data-value="auto"]')); await wait(20);
  assert.equal(app.doc.documentElement.getAttribute('data-theme'), null);
  assert.equal(app.w.Calc.CATEGORIES.investment_accounts.color, light);
});

test('conturi șterse din greșeală pe telefon: „Trimite datele de aici” de pe web le aduce înapoi', async () => {
  const drive = createDrive();
  const data = makeFamily();
  drive.put(data);
  const webLocal = new Map(), phoneLocal = new Map();
  // telefonul șterge contul XTB și sincronizează → ștergerea ajunge în Drive
  let phone = await boot({ data, drive, settings: connected, base: data, local: phoneLocal });
  await wait(600);
  await phone.nav('investments');
  const card = phone.qa('#app article.card').find((a) => a.textContent.includes('XTB'));
  phone.click(card.querySelector('[data-action="delete"]')); await phone.confirm(); await wait(2500);
  assert.ok(!drive.json(drive.appFile().id).investment_accounts.some((a) => a.id === 'inv_xtb'), 'ștergerea a ajuns în Drive');
  // web: are încă XTB → suprascrie Drive-ul
  // web: pornit fără sincronizarea automată (ca atunci când accesul Google a expirat) — are încă XTB
  const web = await boot({ data, drive, settings: connected, token: true, local: webLocal, online: false });
  web.w.navigator.onLine = true;
  await web.nav('settings');
  web.click(web.q('[data-action="forcePush"]')); await web.confirm(); await wait(800);
  assert.ok(drive.json(drive.appFile().id).investment_accounts.some((a) => a.id === 'inv_xtb'), 'Drive-ul are din nou XTB');
  // telefonul sincronizează → primește XTB înapoi
  phone = await boot({ drive, settings: connected, local: phoneLocal });
  await wait(1500);
  assert.ok(phone.stored().investment_accounts.some((a) => a.id === 'inv_xtb'), 'telefonul a primit XTB înapoi');
  assert.equal(phone.errors.length + web.errors.length, 0, phone.errors.concat(web.errors).join('; '));
});

test('jurnal: un cont șters se poate restaura cu un click', async () => {
  const app = await boot({ data: makeFamily() });
  await app.nav('investments');
  const card = app.qa('#app article.card').find((a) => a.textContent.includes('XTB'));
  app.click(card.querySelector('[data-action="delete"]')); await app.confirm(); await wait(50);
  assert.ok(!app.stored().investment_accounts.some((a) => a.id === 'inv_xtb'));
  await app.nav('settings');
  app.click(app.q('[data-action="restoreDeleted"]')); await wait(50);
  const x = app.stored().investment_accounts.find((a) => a.id === 'inv_xtb');
  assert.ok(x && x.total_value === 200, 'restaurat identic (același id)');
  await app.nav('settings');
  assert.ok(!app.q('[data-action="restoreDeleted"]'), 'butonul dispare după restaurare');
});

