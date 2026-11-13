# Operațiuni: configurare, deploy, backup, responsabilități

## 1. Mediu și chei
- `supabase.js` conține **doar** URL-ul proiectului și cheia `anon`/publishable (sigură în browser **doar dacă RLS este activ** — este, vezi `rls_test.sql`).
- **Nu** pune niciodată `service_role` sau alte secrete în repo/frontend. Pentru Edge Functions folosește `supabase secrets set NUME=valoare`.
- Dacă o cheie secretă a ajuns vreodată în Git: rotește-o din Supabase → Project Settings → API.

## 2. Mediu de test separat
1. Creează un proiect Supabase **de staging** (gratuit).
2. Rulează migrările în ordine: `0001_schema_and_rls.sql`, `0002_storage_and_safeguards.sql`, `0003_optional_guest_event_registration.sql`, `0003_optional_guest_event_registration.sql`.
3. Rulează `psql -v ON_ERROR_STOP=1 -f rls_test.sql` conectat la staging (scriptul folosește comenzi psql și face `ROLLBACK`; nu rula pe producție).
4. Abia apoi aplică aceleași migrări pe producție.

## 3. Migrare pe producția existentă (verifică înainte!)
1. Exportă schema curentă: `supabase db dump --schema public > backup_inainte.sql` (sau backup din Dashboard).
2. Compară tabelele/coloanele existente cu `SCHEMA.md`. `CREATE TABLE IF NOT EXISTS` **nu** modifică tabele existente: coloanele lipsă se adaugă printr-o migrare separată `0003_optional_guest_event_registration.sql`.
3. Datele existente nu au `status` valid → după migrare rulează o singură dată `update <tabel> set status='published' where status is distinct from 'published';` pentru conținutul deja afișat public.
4. Primul admin: `insert into user_roles (user_id, role) values ('<uuid din auth.users>', 'admin');`

## 4. Teste
| Comandă | Ce verifică |
|---|---|
| `npm run test:unit` | Logica formularelor (validare, erori, editare, anti-XSS) cu mock Supabase |
| `psql -v ON_ERROR_STOP=1 -f rls_test.sql` | 49 verificări RLS: anonim / utilizator / proprietar ONG / admin, constrângeri, limite, Storage |
| `npm run test:e2e` | Smoke test desktop + mobil (Playwright) — de adaptat la selectorii reali |
| `bash audit-mock.sh` | Candidați pentru conținut demo/succes fals (Faza 2) |

## 5. Deploy
Site static: orice host static (GitHub Pages, Netlify, Cloudflare Pages). Nu există pas de build. Publică rădăcina repo-ului (`index.html`, `app.js`, `data.js`, `forms.js`, `auth.js`, `ui.css`, `supabase.js`). În Supabase → Authentication → URL Configuration adaugă domeniul de producție la *Site URL* / *Redirect URLs*.

## 6. Backup și recuperare
- Activează backup-urile automate (plan Pro) sau programează `supabase db dump` săptămânal într-un loc separat.
- Fișierele din Storage nu sunt incluse în dump-ul SQL — exportă-le separat dacă sunt critice.
- Test de recuperare: restaurează ultimul dump într-un proiect de staging, rulează `rls_test.sql`.

## 7. Moderare și audit
- Toate trimiterile publice intră ca `pending_review`; moderatorii le aprobă/resping din `YSForms.openModeration()`.
- `audit_log` păstrează versiunea veche/nouă pentru ONG, persoane, proiecte, evenimente, colaborări, finanțări, resurse. Citibil doar de staff.
- Limite: 10 trimiteri/zi/secțiune, 20 postări/oră, 60 comentarii/oră per utilizator (triggere în `0002`).

## 8. Responsabilități (de completat)
| Zonă | Responsabil |
|---|---|
| Proiect Supabase / chei / billing | _de stabilit_ |
| Moderare conținut | _de stabilit_ |
| Deploy site | _de stabilit_ |
| Backup & recuperare | _de stabilit_ |

## 9. Decizii deschise
- **Editarea conținutului publicat:** acum proprietarul poate edita o înregistrare `published` fără re-aprobare (statusul nu se schimbă). Dacă vrei re-moderare la fiecare editare, adaugă un trigger care mută statusul în `pending_review` pentru non-staff.
- **Bucket `resource-files` public:** orice fișier încărcat e accesibil prin URL. Pentru fișiere private, schimbă `public=false` și folosește URL-uri semnate.
- **Contact public:** `people.public_contact` și `ngos.contact_email` sunt vizibile oricui când înregistrarea e publicată — afișează un avertisment în formular (consimțământ).