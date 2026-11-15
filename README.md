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
| `index.html` | Shell HTML + Tailwind CDN |
| `js/app.js` | State, randare UI, profiluri, formulare |
| `js/drive-sync.js` | GIS OAuth2 + Drive API (list / get / POST multipart / PATCH) |
| `js/calculators.js` | Splitting, conversii valutare, zile rămase, alerte |
| `sw.js` | Cache offline (network-first pentru app, cache-first pentru CDN) |

## Parole pe profil
Fiecare membru poate avea o parolă (Membri → 🔑, sau 🔑 din antet pentru propriul profil). Se salvează doar hash-ul PBKDF2-SHA256 cu salt aleator, în `family_members[].auth`, care se sincronizează în Drive. Adminul poate reseta parola oricui. Parola blochează interfața, nu criptează datele.

## Analiză avere
Pagina „Analiză avere” filtrează pe membri, categorii și moneda de afișare și grupează pe membri, categorii, instituție, monedă, într-o matrice membri × categorii sau într-o listă cu căutare, sortare și export CSV.

## Câmpuri adăugate la schemă (opționale, compatibile)
- `family_members[].auth` — `{ algo, iter, salt, hash }` pentru parola profilului
- `children_savings[].balance_history` — istoricul soldului pentru grafic
- `children_savings[].tracker_year` — resetarea anuală a `yearly_deposited`
- `government_bonus_tracker.bonus_amount` — implicit 600

La schimbarea fișierelor aplicației, mărește `CACHE` din `sw.js` (ex. `fw-pwa-v2`).
