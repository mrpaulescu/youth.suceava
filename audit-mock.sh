#!/usr/bin/env bash
# Faza 2 — găsește rămășițe de conținut demo. Rulează din rădăcina repo-ului: bash scripts/audit-mock.sh
# Rezultatele sunt CANDIDAȚI de verificat manual (nu toate sunt greșeli).
F="index.html app.js"
sec(){ printf '\n=== %s ===\n' "$1"; }
sec "Offset-uri/numere fixe adăugate la metrici (ex: + 12, +47)";      grep -nE '\+\s*[0-9]{1,4}\b' $F | grep -viE 'px|rem|%|ms|index|length' | head -40
sec "Cuvinte-cheie demo / mock / sample / fake";                         grep -niE 'demo|mock|sample|fake|placeholder|lorem|dummy|test@' $F | head -40
sec "Email-uri / nume hard-coded";                                       grep -nE '[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[a-z]{2,}' $F | head -20
sec "Mesaje de succes (verifică să vină DUPĂ răspunsul serverului)";     grep -niE 'toast\(|notify\(|alert\(' app.js | head -60
sec "Acțiuni cu setTimeout (confirmări simulate)";                        grep -nE 'setTimeout' app.js | head -20
sec "ID-uri numerice hard-coded";                                        grep -nE "id\s*:\s*[0-9]+|\(\s*[0-9]+\s*\)" app.js | head -20
sec "Mutații locale fără persistență (push/splice/unshift pe array-uri de date)"; grep -nE '(NGOS|EVENTS|COLLABS|PEOPLE|FUND|POSTS|posts)\.(push|splice|unshift|filter)|=\s*(NGOS|EVENTS|COLLABS|PEOPLE|FUND)\.' app.js | head -30
sec "Scrieri Supabase existente (insert/update/delete/upsert/rpc)";       grep -nE '\.(insert|update|delete|upsert|rpc)\(' app.js | head -40
sec "Citiri Supabase fără verificarea lui error (.from(...) fără 'error')"; grep -nE 'await supabase|supabase\s*\.from' app.js | grep -v error | head -30
sec "innerHTML cu interpolare (risc XSS — folosește esc())";             grep -nE 'innerHTML\s*[+]?=\s*`|\$\{' app.js | grep -v 'esc(' | head -40
sec "Share / copiere link / deschidere resursă (demo?)";                  grep -niE 'share|clipboard|openResource|download' app.js | head -20