# Youth Suceava

Platformă civică pentru Suceava și Bucovina: ONG-uri, evenimente, oameni, colaborări, finanțări, resurse și un flux comunitar. Frontend static HTML/CSS/JavaScript cu Supabase pentru autentificare, PostgreSQL, Row Level Security și Storage.

## Structură

- `index.html`, `app.js`, `app.css` — interfața SPA.
- `supabase.js` — Supabase URL și cheia publică anon/publishable.
- `data.js` — strat de acces la date, validare răspunsuri, directory și Storage.
- `forms.js` — formulare de contribuție, răspunsuri la colaborări și moderare.
- `supabase/migrations/` — migrările SQL versionate.
- `forms.test.js` — teste unitare jsdom.
- `rls_test.sql` — verificări RLS (doar staging).
- `smoke.spec.js` — smoke tests Playwright.
- `audit-mock.sh` — audit orientativ al conținutului demo.
- `SCHEMA.md`, `OPERATIONS.md`, `CONTEXT.md` — modelul de date, operare și context proiect.

## Dezvoltare locală

Cerințe: Node.js 20+ și Python 3.

```bash
npm install
npm run serve
```

Deschide http://localhost:8000.

## Verificări

```bash
npm run test:unit
npx playwright install chromium
npm run test:e2e
npm run audit:mock
```

## Ordinea scripturilor

În `index.html`: Supabase JS SDK → `supabase.js` → aliasul global Supabase → `data.js` → `forms.js` → `app.js`.

## Database și deployment

Rulează `supabase/migrations/0001_schema_and_rls.sql`, apoi `0002_storage_and_safeguards.sql` într-un proiect Supabase de staging. Rulează `rls_test.sql` pe staging, niciodată pe producție. Citește `OPERATIONS.md` înainte de a aplica migrările în proiectul existent; schema live trebuie comparată și salvată înainte de orice modificare.

Pentru deploy static, publică rădăcina repository-ului și configurează domeniul în Supabase Authentication → URL Configuration. Activarea efectivă a producției necesită verificarea proiectului Supabase, a politicilor RLS, a domeniului și a testelor; simpla publicare a fișierelor nu finalizează aceste verificări.

## Securitate

Cheia anon/publishable poate exista în frontend numai cu RLS corect configurat. Nu comite niciodată service-role keys sau alte secrete. Datele introduse de utilizatori trebuie randate prin escaping; permisiunile sunt impuse de RLS, nu doar prin ascunderea butoanelor.
