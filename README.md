# Patrimoniu Familial — PWA Local-First

PWA static, fără backend și fără build. Datele stau în `localStorage` și, opțional, în `appDataFolder` din Google Drive (`family_wealth_data.json`).

## Rulare locală
```bash
python -m http.server 8090
# deschide http://localhost:8090
```
(Service Worker-ul și Google OAuth cer `http://localhost` sau HTTPS; nu merge cu `file://`.)

## Publicare (Vercel / Netlify / GitHub Pages)
Urcă folderul așa cum este. Nu e nevoie de build.

## Google Drive
1. Google Cloud Console → proiect nou → activează **Google Drive API**.
2. OAuth consent screen → External → Testing → adaugă emailurile familiei la *Test users*.
3. Scope: `https://www.googleapis.com/auth/drive.appdata`
4. Credentials → OAuth client ID → *Web application* → adaugă URL-ul de producție (și `http://localhost:8090` pentru teste — exact portul pe care rulezi local) la *Authorized JavaScript origins*.
5. Pune Client ID-ul în aplicație (Setări) sau în `CONFIG.GOOGLE_CLIENT_ID` din `js/app.js`.

Notă: `appDataFolder` aparține unui singur cont Google. Pentru conturi Google diferite în familie, folosiți **fișierul partajat** (mai jos).

### Fișier partajat (fiecare membru cu contul lui)
Setări → Google Drive → „📤 Creează fișier partajat” (cere criptarea activă) → „➕ Dă acces” cu emailul membrului. Membrul se conectează cu contul lui și alege „📂 Alege un fișier partajat cu mine”. Aplicația folosește scope-ul `drive.file`: vede doar fișierele create de ea sau alese explicit în selectorul Google.

Configurare suplimentară în Google Cloud:
1. APIs & Services → Library → activează **Google Picker API**.
2. Google Auth Platform → Data Access → adaugă scope-ul `https://www.googleapis.com/auth/drive.file`.
3. Credentials → Create credentials → **API key** → restricționează-l: *Application restrictions* = Websites (`https://poparaul.github.io/*`, `http://localhost:8080/*`), *API restrictions* = Google Picker API. Pune cheia în Setări sau în `CONFIG.GOOGLE_API_KEY`.
4. Audience → Test users: adaugă emailul fiecărui membru.

### Sincronizare cu îmbinare
Fiecare dispozitiv păstrează versiunea de la ultima sincronizare (`fw_sync_base`, criptată ca datele). La sincronizare se face îmbinare în 3 direcții (`js/merge.js`): conturile se potrivesc după `id`, câmpurile modificate doar pe o parte se păstrează, iar la un câmp schimbat pe ambele părți câștigă `updated_at` mai recent. Prima sincronizare a unui dispozitiv (fără bază) folosește regula „fișierul mai nou câștigă”.

## Structură
| Fișier | Rol |
|---|---|
| `index.html` | Shell HTML + CSP |
| `js/app.js` | State, randare UI, profiluri, formulare |
| `js/drive-sync.js` | GIS OAuth2 + Drive API (list / get / POST multipart / PATCH) |
| `js/vault.js` | Criptare AES-256-GCM cu parola familiei |
| `js/merge.js` | Îmbinare în 3 direcții la sincronizare |
| `tests/` | Teste `node --test` + jsdom, date fictive |
| `js/calculators.js` | Splitting, conversii valutare, zile rămase, alerte |
| `sw.js` | Cache offline (network-first pentru app, cache-first pentru CDN) |

## Criptare (parola familiei)
Setări → 🔐 Criptare date. Datele sunt criptate cu AES-256-GCM, cu o cheie derivată din parola familiei (PBKDF2-SHA256, 600.000 iterații, salt aleator) — `js/vault.js`.
- Criptate: `localStorage` (`fw_data`), fișierul din Google Drive și exportul „criptat”. Necriptat rămâne doar `last_updated`, pentru sincronizare.
- Parola se cere o dată pe sesiune de browser; în sesiune se păstrează doar cheia derivată (`sessionStorage`), nu parola.
- Un dispozitiv fără parolă nu poate suprascrie fișierul criptat din Drive; la prima sincronizare cere parola.
- Schimbarea parolei generează salt nou; celelalte dispozitive cer parola nouă. Backupurile criptate vechi se deschid cu parola lor.
- **Fără parolă datele nu pot fi recuperate.**

## Securitate pagină
- Fără scripturi de pe CDN: Tailwind e generat local în `css/tailwind.css` (vezi `tailwind.config.js`). După ce adaugi clase noi:
  `npx tailwindcss@3.4.16 -i css/tailwind.input.css -o css/tailwind.css --minify`
- Content-Security-Policy în `index.html`: scripturi doar din aplicație și Google Identity Services; conexiuni doar spre Google APIs.

## Funcții
- **Actualizare rapidă** (tab „Actualizare”): toate soldurile într-o listă, salvate o dată.
- **Evoluția averii**: o fotografie lunară a totalurilor (`history`, sincronizată) → grafic pe Panou.
- **Cursuri automate**: cursul de referință BCE prin `api.frankfurter.dev`, o dată la 6 ore pe dispozitivele administratorilor (BNR nu permite citirea din browser — lipsește CORS).
- **Venituri pasive**: dobânzi la scadența depozitelor și cupoane anuale la titluri de stat (data cuponului = ziua/luna scadenței; Fidelis/Tezaur fără impozit), pe următoarele 12 luni.
- **Backup-uri**: săptămânal, criptat, în `appDataFolder` al contului conectat; se păstrează ultimele 10; restaurare din Setări.
- **Jurnal de modificări** (`changelog`, ultimele 300): cine, ce, când.
- **Reînnoire depozit** la scadență, cu dobânda capitalizată.
- **Obiective** (`goals`) cu conturi legate, progres și suma lunară necesară.
- **Export calendar (.ics)**: scadențe, cupoane, documente auto, cu alarme cu 7 și 1 zi înainte.
- **Temă** automată / luminoasă / întunecată; paleta graficelor are nuanțe separate pentru fundal închis.

## Teste
```bash
npm ci
npm test            # unitare (îmbinare, calcule, criptare + sincronizare) și interfață (aplicația reală în jsdom)
npm run build:css   # regenerează css/tailwind.css după ce adaugi clase noi
```
Testele folosesc doar date fictive (`tests/fixtures/family.js`) și un Google Drive simulat. Rulează automat pe GitHub la fiecare push (`.github/workflows/tests.yml`), care verifică și că `css/tailwind.css` e la zi.

## Parole pe profil
Fiecare membru poate avea o parolă (Membri → 🔑, sau 🔑 din antet pentru propriul profil). Se salvează doar hash-ul PBKDF2-SHA256 cu salt aleator, în `family_members[].auth`, care se sincronizează în Drive. Adminul poate reseta parola oricui. Parola blochează interfața, nu criptează datele.

## Analiză avere
Pagina „Analiză avere” filtrează pe membri, categorii și moneda de afișare și grupează pe membri, categorii, instituție, monedă, într-o matrice membri × categorii sau într-o listă cu căutare, sortare și export CSV.

## Câmpuri adăugate la schemă (opționale, compatibile)
- `family_members[].auth` — `{ algo, iter, salt, hash }` pentru parola profilului
- `children_savings[].balance_history` — istoricul soldului pentru grafic
- `children_savings[].tracker_year` — resetarea anuală a `yearly_deposited`
- `government_bonus_tracker.bonus_amount` — implicit 600

La schimbarea fișierelor aplicației, mărește `CACHE` din `sw.js` (ex. `fw-pwa-v7`).
