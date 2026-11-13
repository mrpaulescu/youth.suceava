-- Teste RLS — rulează într-o tranzacție și face ROLLBACK la final.
-- Local: psql -v ON_ERROR_STOP=1 -d ys -f tests/local_stub.sql  (o singură dată), apoi migrările, apoi acest fișier.
-- Pe un proiect Supabase de TEST: rulează direct în SQL Editor (nu stub-ul!). Nu rula pe producție.
\set ON_ERROR_STOP on
begin;

create function _assert(c boolean, m text) returns void language plpgsql as
$$ begin if c is not true then raise exception 'FAIL: %', m; end if; raise notice 'PASS: %', m; end $$;
create function _rows(q text) returns int language plpgsql as
$$ declare n int; begin execute q; get diagnostics n = row_count; return n; end $$;
create function _fails(q text) returns boolean language plpgsql as
$$ begin execute q; return false; exception when others then return true; end $$;
create function _as(u uuid) returns void language plpgsql as
$$ begin perform set_config('request.jwt.claim.sub', coalesce(u::text,''), false);
         execute case when u is null then 'set role anon' else 'set role authenticated' end; end $$;
create function _reset() returns void language plpgsql as
$$ begin execute 'reset role'; perform set_config('request.jwt.claim.sub','',false); end $$;

-- ---------- seed (ca superuser) ----------
insert into auth.users (id, email) values
 ('00000000-0000-0000-0000-0000000000a1','alice@t.ro'),
 ('00000000-0000-0000-0000-0000000000b2','bob@t.ro'),
 ('00000000-0000-0000-0000-0000000000c3','carol@t.ro');
insert into user_roles values ('00000000-0000-0000-0000-0000000000c3','admin');
insert into ngos (id, created_by, name, status) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','ONG publicat','published'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1','ONG in asteptare','pending_review');
insert into events (id, created_by, ngo_id, title, starts_at, status) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','10000000-0000-0000-0000-000000000001','Eveniment publicat', now()+interval '1 day','published'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000a1',null,'Eveniment draft', now()+interval '2 day','draft');
insert into collaborations (id, created_by, title, type, status) values
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Colab publicata','volunteer','published');
insert into funding_opportunities (id, title, status) values ('40000000-0000-0000-0000-000000000001','Finantare','published');
insert into posts (id, author_id, body) values ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','Salut');

\set alice '''00000000-0000-0000-0000-0000000000a1'''
\set bob   '''00000000-0000-0000-0000-0000000000b2'''
\set carol '''00000000-0000-0000-0000-0000000000c3'''

-- ---------- ANONIM ----------
select _as(null);
select _assert((select count(*) from ngos) = 1, 'anonim vede doar ONG-urile publicate');
select _assert((select count(*) from events) = 1, 'anonim nu vede evenimente draft');
select _assert((select count(*) from profiles) >= 0, 'anonim poate citi profiluri');
select _assert(_fails($$insert into posts (author_id, body) values ('00000000-0000-0000-0000-0000000000a1','x')$$), 'anonim nu poate posta');
select _assert(_fails($$insert into ngos (name, created_by) values ('Fals', null)$$), 'anonim nu poate crea ONG');
select _assert((select count(*) from notifications) = 0, 'anonim nu vede notificări');
select _assert((select count(*) from audit_log) = 0, 'anonim nu vede audit');
select _reset();

-- ---------- UTILIZATOR ORDINAR (bob) ----------
select _as(:bob::uuid);
select _assert(_fails($$insert into ngos (name, created_by, status) values ('Auto-publicat', auth.uid(), 'published')$$), 'bob nu poate auto-publica un ONG');
select _assert(_rows($$insert into ngos (name, created_by, status) values ('ONG bob', auth.uid(), 'pending_review')$$) = 1, 'bob poate trimite un ONG spre aprobare');
select _assert((select count(*) from ngos where name='ONG bob') = 1, 'bob își vede ONG-ul în așteptare');
select _assert((select count(*) from ngos where name='ONG in asteptare') = 0, 'bob nu vede ONG-ul în așteptare al Alicei');
select _assert(_rows($$update ngos set name='Hack' where id='10000000-0000-0000-0000-000000000001'$$) = 0, 'bob nu poate edita ONG-ul Alicei');
select _assert(_fails($$insert into user_roles values (auth.uid(),'admin')$$), 'bob nu își poate da rol de admin');
select _assert(_fails($$insert into funding_opportunities (title, status) values ('F','published')$$), 'bob nu poate crea finanțări');
select _assert((select count(*) from audit_log) = 0, 'bob nu vede audit');

-- feed
select _assert(_rows($$insert into posts (author_id, body) values (auth.uid(),'Postarea lui bob')$$) = 1, 'bob poate posta');
select _assert(_fails($$insert into posts (author_id, body) values ('00000000-0000-0000-0000-0000000000a1','impersonare')$$), 'bob nu poate posta în numele Alicei');
select _assert(_rows($$insert into post_likes (post_id) values ('50000000-0000-0000-0000-000000000001')$$) = 1, 'bob poate da like');
select _assert(_fails($$insert into post_likes (post_id) values ('50000000-0000-0000-0000-000000000001')$$), 'like duplicat respins');
select _assert(_rows($$insert into comments (post_id, body) values ('50000000-0000-0000-0000-000000000001','Bravo')$$) = 1, 'bob poate comenta');
select _assert(_rows($$delete from posts where id='50000000-0000-0000-0000-000000000001'$$) = 0, 'bob nu poate șterge postarea Alicei');

-- follow
select _assert(_fails($$insert into follows (user_id) values (auth.uid())$$), 'follow fără țintă respins');
select _assert(_rows($$insert into follows (ngo_id) values ('10000000-0000-0000-0000-000000000001')$$) = 1, 'bob poate urmări un ONG');
select _assert(_fails($$insert into follows (ngo_id) values ('10000000-0000-0000-0000-000000000001')$$), 'follow duplicat respins');

-- înregistrări
select _assert(_rows($$insert into event_registrations (event_id) values ('20000000-0000-0000-0000-000000000001')$$) = 1, 'bob se înscrie la eveniment publicat');
select _assert(_fails($$insert into event_registrations (event_id) values ('20000000-0000-0000-0000-000000000001')$$), 'înscriere dublă respinsă');
select _assert(_fails($$insert into event_registrations (event_id) values ('20000000-0000-0000-0000-000000000002')$$), 'nu te poți înscrie la un eveniment draft');

-- colaborări + saved funding
select _assert(_rows($$insert into collaboration_responses (collaboration_id, message) values ('30000000-0000-0000-0000-000000000001','Vreau să ajut')$$) = 1, 'bob răspunde la colaborare');
select _assert(_rows($$insert into saved_funding (funding_id) values ('40000000-0000-0000-0000-000000000001')$$) = 1, 'bob salvează o finanțare');

-- storage
select _assert(_rows($$insert into storage.objects (bucket_id, name) values ('avatars','00000000-0000-0000-0000-0000000000b2/a.png')$$) = 1, 'bob încarcă în folderul lui');
select _assert(_fails($$insert into storage.objects (bucket_id, name) values ('avatars','00000000-0000-0000-0000-0000000000a1/a.png')$$), 'bob nu poate încărca în folderul Alicei');

-- limită anti-abuz: 10 resurse pe zi
select _assert((select count(*) from (select _rows(format($f$insert into resources (title, url, status) values ('R%s','https://x.ro','pending_review')$f$, g)) from generate_series(1,10) g) s) = 10, 'bob trimite 10 resurse');
select _assert(_fails($$insert into resources (title, url, status) values ('R11','https://x.ro','pending_review')$$), 'a 11-a resursă în 24h este respinsă');
select _reset();

-- ---------- PROPRIETAR ONG (alice) ----------
select _as(:alice::uuid);
select _assert((select count(*) from ngos where name='ONG in asteptare') = 1, 'alice își vede ONG-ul în așteptare');
select _assert(_rows($$update ngos set tagline='Nou' where id='10000000-0000-0000-0000-000000000002'$$) = 1, 'alice își poate edita ONG-ul');
select _assert(_fails($$update ngos set status='published' where id='10000000-0000-0000-0000-000000000002'$$), 'alice nu poate publica singură');
select _assert((select count(*) from event_registrations) = 1, 'organizatorul vede înscrierile la evenimentul lui');
select _assert((select count(*) from collaboration_responses) = 1, 'proprietarul colaborării vede răspunsurile');
select _assert((select count(*) from notifications) = 2, 'alice a primit notificări (comentariu + răspuns colaborare)');
select _assert(_rows($$update notifications set read_at = now()$$) = 2, 'alice marchează notificările citite');
select _assert(_fails($$insert into notifications (user_id, type, message) values (auth.uid(),'x','falsa')$$), 'utilizatorii nu pot crea notificări direct');
select _reset();

-- ---------- ADMIN (carol) ----------
select _as(:carol::uuid);
select _assert((select count(*) from ngos) >= 3, 'admin vede toate ONG-urile');
select _assert(_rows($$update ngos set status='published' where id='10000000-0000-0000-0000-000000000002'$$) = 1, 'admin aprobă un ONG');
select _assert(_rows($$update ngos set status='rejected', rejection_reason='Incomplet' where name='ONG bob'$$) = 1, 'admin respinge cu motiv');
select _assert(_rows($$insert into funding_opportunities (title, status) values ('Nou','published')$$) = 1, 'admin creează finanțări');
select _assert((select count(*) from audit_log) > 0, 'admin vede auditul');
select _assert(_rows($$delete from posts where id='50000000-0000-0000-0000-000000000001'$$) = 1, 'admin poate modera (șterge) postări');
select _reset();

-- ---------- ANONIM după aprobare ----------
select _as(null);
select _assert((select count(*) from ngos where name='ONG in asteptare') = 1, 'ONG aprobat devine public');
select _assert((select count(*) from ngos where name='ONG bob') = 0, 'ONG respins rămâne ascuns');
select _reset();

rollback;