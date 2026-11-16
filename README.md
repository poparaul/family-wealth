# Patrimoniu Familial — PWA Local-First

PWA static, fără backend și fără build. Datele stau în `localStorage` și, opțional, în `appDataFolder` din Google Drive (`family_wealth_data.json`).

## Rulare locală
```bash
python -m http.server 8080
# deschide http://localhost:8080
```
(Service Worker-ul și Google OAuth cer `http://localhost` sau HTTPS; nu merge cu `file://`.)

## Publicare (Vercel / Netlify / GitHub Pages)
Urcă folderul așa cum este. Nu e nevoie de build.

## Google Drive
1. Google Cloud Console → proiect nou → activează **Google Drive API**.
2. OAuth consent screen → External → Testing → adaugă emailurile familiei la *Test users*.
3. Scope: `https://www.googleapis.com/auth/drive.appdata`
4. Credentials → OAuth client ID → *Web application* → adaugă URL-ul de producție (și `http://localhost:8080` pentru teste) la *Authorized JavaScript origins*.
5. Pune Client ID-ul în aplicație (Setări) sau în `CONFIG.GOOGLE_CLIENT_ID` din `js/app.js`.

Notă: `appDataFolder` aparține unui singur cont Google. Pentru aceleași date pe mai multe dispozitive, folosiți același cont Google.

## Structură
| Fișier | Rol |
|---|---|
| `index.html` | Shell HTML + CSP |
| `js/app.js` | State, randare UI, profiluri, formulare |
| `js/drive-sync.js` | GIS OAuth2 + Drive API (list / get / POST multipart / PATCH) |
| `js/vault.js` | Criptare AES-256-GCM cu parola familiei |
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
