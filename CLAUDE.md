# CLAUDE.md

"Patrimoniu Familial": a local-first PWA for tracking a family's wealth. It has no backend and no build step. It is served as static files from GitHub Pages (https://poparaul.github.io/family-wealth/). The UI, code comments, test names and README are all in **Romanian**, and new UI text and comments should be Romanian too.

## Commands

```bash
npm ci
npm test                                         # node --test tests/ (unit + UI in jsdom)
node --test tests/ui/sync.test.js                # one file
node --test --test-name-pattern="partajat" tests/  # tests whose name matches
npm run build:css                                # regenerate css/tailwind.css after adding Tailwind classes
python -m http.server 8080                       # run locally → http://localhost:8080 (not file://)
```

CI (`.github/workflows/tests.yml`) runs `npm test` and then fails if `npm run build:css` changes `css/tailwind.css`. **Commit the rebuilt CSS whenever you add or change Tailwind classes** in `index.html` or `js/**/*.js`.

Use port 8080 locally. It is an authorized OAuth origin, and port 8090 belongs to another project. The README still says 8090.

## Release checklist (every change to app files)

1. Bump the version in **both** `sw.js` (`const CACHE = 'fw-pwa-vN'`) and `js/app.js` (`const APP_VERSION = 'vN'`). `tests/unit/version.test.js` checks that they match. Phones only pick up new code when the service-worker cache name changes.
2. If you added any files to the app shell, add them to `SHELL` in `sw.js`.
3. Run `npm run build:css` if classes changed, then `npm test`.
4. Pushes go straight to `main`, which GitHub Pages deploys. Ask the user before pushing.

## Architecture

Plain browser scripts (no modules, no bundler) are loaded in this order by `index.html`. Each one is an IIFE that sets a global:

| File | Global | Role |
|---|---|---|
| `js/calculators.js` | `Calc` | Pure functions: currency conversion (`toBase`), splits, `assets()`/`netWorth()`/`memberAssets()`, alerts, income schedule, deposit math, formatting, palettes (light/dark) |
| `js/merge.js` | `FWMerge` | 3-way merge (base/local/remote) by `id`, field by field. Conflicts are resolved by the newer `updated_at`. `stampChanges` sets `updated_at` on edited items |
| `js/vault.js` | `FWVault` | AES-256-GCM encryption with a family password (PBKDF2-SHA256, 600k iterations). The same envelope `{fw_vault:1, ct, salt, ...}` is used in localStorage, Drive and exports. The session stores only the derived key |
| `js/drive-sync.js` | `DriveSync` | Google Identity Services OAuth token, Drive v3 (appDataFolder or a shared visible file via `drive.file` + Picker), backups, Sheets API. Calls are serialized through a promise queue |
| `js/app.js` | — | Everything else (~3.7k lines), in sections marked by `/* ===== */` banners: CONFIGURARE, UTILITARE, STATE, SINCRONIZARE GOOGLE DRIVE, TOAST & MODAL, FORMULARE GENERICE, COMPONENTE UI, VIEWS, RENDER, PROFILURI & PIN, ACȚIUNI, EVENIMENTE, INIT |

### How app.js works

- **State**: `state` (data, profileId, view, sync, modal) plus per-device `settings` (localStorage `fw_settings`). Shorthands: `D()` = data, `M()` = metadata.
- **Rendering**: string templates. `render()` rebuilds `#app.innerHTML` from `VIEWS[state.view]()`, wrapped in `renderShell`. **Always escape user data with `esc()`.** Amounts go through `money(v)`, where `v` is in the base currency and gets converted to the display currency, or `money(v, cur)`, which shows `v` as is. Both respect the "hide amounts" mode.
- **Events**: delegated listeners on `document`. A `data-action="x"` element runs `actions.x(dataset, el, e)`. A `<form data-form="y">` runs `formHandlers.y(form)`. Modal forms use `data-modal-form` with `openModal({ onSubmit })`. Navigation uses `data-view`.
- **Mutations**: always use `commit(mutator, toastMsg)`. It stamps `updated_at` (needed for merging), writes the changelog, and calls `persist()`. `persist()` updates the monthly `history` snapshot, saves locally (encrypted if the vault is on) and schedules a Drive sync about 1.5 s later.
- **Generic CRUD**: `SCHEMAS[collection]` describes the fields (`k` is a dotted path, plus `type`, `req`, `showIf`, `list`). `openForm(collection, id)` builds the form from it. `splits: true` adds the ownership-percentage editor (`splits: [{member_id, percentage}]`, which must sum to 100).
- **Roles**: `admin` sees everything (`NAV_ADMIN`). `viewer` sees only its own share (`NAV_VIEWER`). `viewer_restricted` is "child mode" (`renderChildMode`). Profile passwords only lock the UI. They are stored as PBKDF2 hashes in `family_members[].auth`.
- **Sync** (`runSync`): `DriveSync.sync(local, { base })` merges against `fw_sync_base`, which is the last synced copy on this device. A device with no base falls back to "newer file wins". Edits made while a sync is running get merged and trigger another sync. `NEED_PASSWORD` errors prompt for the vault password.
- **Init**: theme → service worker (auto-reload on `controllerchange`) → decrypt or show the lock screen → `normalizeData` (fills in missing collections, plus monthly and yearly rollovers for children's accounts) → demo data if nothing is stored.

### Data model (JSON, synced as `family_wealth_data.json`)

Collections: `family_members`, `investment_accounts`, `grandparents_accounts` (banks & deposits; the name is historical), `real_estate`, `children_savings`, `vehicles`, `goals`, `history` (monthly net-worth snapshots), `pf_history` (portfolio profit), `changelog` (last 300 entries), plus `metadata` (`base_currency`, `exchange_rates` as base-per-unit, `last_updated`) and `emergency_guide`. Real estate and vehicles are listed but **excluded from net worth** (`Calc.WORTH_EXCLUDED` / `Calc.inWorth`): dashboard, members, analysis and monthly snapshots (`fin: 1`; older snapshots are adjusted at render time by `histValue`). The emergency guide inventory still lists them. Crypto is not a separate collection. It is an investment account whose `account_type` matches `Calc`'s `isCrypto`. New fields must be **optional and backward compatible**. Old files on other devices still have to load and merge. If you add a collection, add it to `normalizeData`, to `COLLECTIONS` in `merge.js` and to `Calc.assets` if it holds value.

localStorage keys: `fw_data`, `fw_profile`, `fw_settings`, `fw_analysis`, `fw_sync_base`, `fw_drive_token`, `fw_drive_file_id`. Session keys: `fw_vault_session`, `fw_unlocked_profile`.

### External services (also allowed by the CSP in `index.html`)

- Google Drive, Sheets and Picker. A holdings sheet with GOOGLEFINANCE formulas sets broker account values. GOOGLEFINANCE does not price many UCITS, Xetra or BVB symbols.
- `api.frankfurter.dev` supplies ECB exchange rates, refreshed automatically every 6 h on admin devices.

If you add a new external host, update the CSP meta tag. If it must never be cached, also add it to `NEVER_CACHE` in `sw.js`.

## Styling

- `css/styles.css` holds the hand-written components (`.card`, `.btn-*`, …) and dark mode (`data-theme="dark"` or the system preference). Tailwind utilities are compiled locally into `css/tailwind.css`. The CSP allows no CDN scripts.
- On phones the layout must never scroll horizontally. Tests check that `.grid > * { min-width: 0; }` and `html, body { overflow-x: clip; }` are present.

## Tests

- `tests/helpers/env.js` → `boot({ data, drive, settings, local, session, base, ... })` loads the real `index.html` and scripts into jsdom, with in-memory storage and a fake Drive, Sheets and Frankfurter (`createDrive()`). Useful helpers: `nav(view)`, `click`, `submit`, `modal()`, `stored()`, `text()`, `errors`. Pass the same `local` Map to simulate a reload on the same device.
- Fixtures (`tests/fixtures/family.js`, `makeFamily(now)`) must stay **fictional**. The repo is public. Never commit real family data, and remind the user to delete any plain-text exports.
- UI tests rely on `data-action`, `data-form`, `data-view` and `data-id` attributes. Keep them stable when refactoring markup.
- Most UI tests assert `app.errors.length === 0`.

## Gotchas

- The sync mode (private appDataFolder vs shared file) is stored **per device** in `settings` and is not part of the synced data. A device left on appDataFolder diverges silently. `maybeAdoptShared()` detects this. When devices disagree, check the sync mode and the sync badge before suspecting the merge logic.
- `CONFIG.GOOGLE_CLIENT_ID` and `GOOGLE_API_KEY` in `app.js` are public by design. The key is restricted in Cloud Console.
- Without the family password, encrypted data cannot be recovered. A device without the password must never overwrite the encrypted Drive file.
