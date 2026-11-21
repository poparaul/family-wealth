const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');

test('APP_VERSION din app.js = versiunea cache-ului din sw.js (altfel telefoanele nu știu că e versiune nouă)', () => {
  const app = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8').match(/const APP_VERSION = '([^']+)'/)[1];
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').match(/const CACHE = 'fw-pwa-([^']+)'/)[1];
  assert.equal(app, sw);
});

test('service worker-ul revalidează la server (ocolește cache-ul HTTP)', () => {
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  assert.ok(sw.includes("fetch(req, { cache: 'no-cache' })"));
});

test('CSS: elementele din grile se pot îngusta (altfel textele lungi lățesc pagina pe telefon)', () => {
  const css = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
  assert.ok(css.includes('.grid > * { min-width: 0; }'));
  assert.ok(/html, body \{ overflow-x: clip; \}/.test(css));
});
