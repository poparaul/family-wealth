// Criptare + sincronizare Drive între două „dispozitive” (fiecare cu localStorage propriu), pe un Drive simulat.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');
const { createDrive, memStorage, ROOT } = require('../helpers/env.js');
const { makeFamily } = require('../fixtures/family.js');
const clone = (x) => JSON.parse(JSON.stringify(x));

function device(drive) {
  const dev = { ls: memStorage(), ss: memStorage() };
  dev.ls.setItem('fw_drive_token', JSON.stringify({ token: 't', expiresAt: Date.now() + 3600e3, fileScope: true }));
  dev.use = () => { globalThis.localStorage = dev.ls; globalThis.sessionStorage = dev.ss; globalThis.fetch = drive.fetch; return dev; };
  dev.load = () => {
    dev.use();
    const win = { crypto: webcrypto };
    globalThis.crypto = webcrypto;
    for (const f of ['js/merge.js', 'js/vault.js', 'js/drive-sync.js']) new Function('window', 'globalThis', fs.readFileSync(path.join(ROOT, f), 'utf8'))(win, win);
    Object.assign(dev, { V: win.FWVault, D: win.DriveSync, M: win.FWMerge });
    return dev;
  };
  dev.sync = async (opts = {}) => { dev.use(); const r = await dev.D.sync(dev.data, Object.assign({ base: dev.base }, opts)); dev.data = r.data; dev.base = clone(r.data); return r; };
  dev.edit = (fn) => { const before = clone(dev.data); fn(dev.data); dev.M.stampChanges(before, dev.data, new Date().toISOString()); dev.data.metadata.last_updated = new Date().toISOString(); };
  return dev.load();
}

test('criptare: anvelopa nu conține date în clar; parolă greșită refuzată; sesiunea revine la reîncărcare', async () => {
  const drive = createDrive();
  const A = device(drive);
  await A.V.setup('Parola2026');
  const env = await A.V.encrypt(makeFamily());
  assert.ok(A.V.isEnvelope(env));
  assert.ok(!JSON.stringify(env).includes('Andrei'));
  assert.equal((await A.V.decrypt(env)).family_members[0].name, 'Andrei');
  assert.equal(await A.V.open('gresit', env), null);
  assert.ok(await A.V.verifyPassword('Parola2026'));
  A.load();
  assert.ok(!A.V.enabled());
  assert.ok(await A.V.restoreSession());
  assert.ok(A.D.hasValidToken(), 'tokenul Drive persistă');
});

test('două dispozitive: modificările se combină, Drive-ul rămâne criptat, fără scrieri inutile', async () => {
  const drive = createDrive();
  const A = device(drive), B = device(drive);
  A.use(); await A.V.setup('Parola2026');
  A.data = makeFamily(); A.base = null;
  assert.equal((await A.sync()).action, 'pushed');
  const file = drive.appFile();
  assert.ok(JSON.parse(file.content).fw_vault === 1 && !file.content.includes('Trading'));

  B.use();
  B.data = makeFamily(); B.data.metadata.last_updated = '2000-01-01T00:00:00Z'; B.base = null;
  let err = null;
  try { await B.D.push(B.data); } catch (e) { err = e; }
  assert.equal(err && err.code, 'NEED_PASSWORD', 'fără parolă nu poate suprascrie fișierul criptat');
  assert.ok(await B.V.unlock('Parola2026', JSON.parse(drive.appFile().content)));
  assert.equal((await B.sync()).action, 'pulled', 'prima sincronizare fără bază: preia');

  A.edit((d) => { d.investment_accounts.find((a) => a.id === 'inv_t212').total_value = 33000; });
  B.edit((d) => { d.grandparents_accounts.find((a) => a.id === 'bank_rf').interest_rate = 7.5; d.investment_accounts = d.investment_accounts.filter((a) => a.id !== 'inv_xtb'); });
  assert.equal((await A.sync()).action, 'pushed');
  assert.equal((await B.sync()).action, 'merged');
  B.use();
  const remote = await B.V.decrypt(JSON.parse(drive.appFile().content));
  assert.equal(remote.investment_accounts.find((a) => a.id === 'inv_t212').total_value, 33000);
  assert.equal(remote.grandparents_accounts.find((a) => a.id === 'bank_rf').interest_rate, 7.5);
  assert.ok(!remote.investment_accounts.find((a) => a.id === 'inv_xtb'));
  assert.equal((await A.sync()).action, 'pulled');
  const writes = drive.st.calls.filter((c) => c.startsWith('PATCH')).length;
  assert.equal((await A.sync()).action, 'none');
  assert.equal(drive.st.calls.filter((c) => c.startsWith('PATCH')).length, writes);
});

test('schimbarea parolei pe un dispozitiv cere parola nouă pe celălalt', async () => {
  const drive = createDrive();
  const A = device(drive), B = device(drive);
  A.use(); await A.V.setup('Parola2026'); A.data = makeFamily(); A.base = null; await A.sync();
  B.use(); await B.V.unlock('Parola2026', JSON.parse(drive.appFile().content)); B.data = clone(A.data); B.base = clone(A.data);
  B.use(); await B.V.setup('ParolaNoua9'); B.edit((d) => { d.emergency_guide.instructions = 'x'; }); await B.sync();
  A.load(); await A.V.restoreSession();
  let err = null;
  try { await A.sync(); } catch (e) { err = e; }
  assert.equal(err && err.code, 'NEED_PASSWORD');
  assert.equal(await A.V.unlock('Parola2026', err.envelope), null);
  assert.ok(await A.V.unlock('ParolaNoua9', err.envelope));
});

test('cont schimbat (preferRemote): Drive-ul nu e suprascris de date locale mai noi', async () => {
  const drive = createDrive();
  const real = makeFamily(); drive.put(real);
  const C = device(drive);
  C.data = makeFamily(); C.data.metadata.last_updated = new Date(Date.now() + 1e7).toISOString(); C.data.family_members[0].name = 'DEMO';
  const r = await C.sync({ preferRemote: true, base: null });
  assert.equal(r.action, 'pulled');
  assert.equal(drive.json(drive.appFile().id).family_members[0].name, 'Andrei');
  assert.equal(await C.D.accountEmail(), 'andrei@example.com');
});
