// Formulare de creare + răspuns + panou de moderare — Youth Suceava
// Depinde de data.js (Ngos, Events, Collabs, Resources, Moderation, run, esc, currentUser) și de clientul `supabase`.
// După orice scriere reușită se emite evenimentul `data:changed` -> reîncarcă datele în app.js (vezi integrarea din răspuns).

(function () {
  const OPT = {
    ngoCat: [['soc','Social'],['edu','Educație'],['env','Mediu'],['civ','Drepturi civice']],
    eventCat: [['edu','Educație'],['env','Mediu'],['soc','Social'],['civ','Drepturi civice']],
    collabType: [['partner', 'Caut parteneri'], ['volunteer', 'Caut voluntari'], ['offer', 'Ofer ajutor'], ['funding', 'Finanțare']],
    resType: [['ghid','Ghid'],['sablon','Șablon'],['webinar','Webinar'],['date','Set de date']],
  };

  const FORMS = {
    ngo: {
      table: 'ngos',
      title: 'Înscrie o organizație', submit: (v) => Ngos.submit(v),
      fields: [
        { n: 'name', l: 'Nume organizație', req: 1, max: 200 },
        { n: 'tagline', l: 'Descriere scurtă', max: 300 },
        { n: 'description', l: 'Descriere', t: 'textarea', max: 3000 },
        { n: 'category', l: 'Categorie', t: 'select', o: OPT.ngoCat, req: 1 },
        { n: 'city', l: 'Oraș' }, { n: 'address', l: 'Adresă' },
        { n: 'website', l: 'Website', t: 'url' },
        { n: 'contact_email', l: 'Email public de contact', t: 'email' },
        { n: 'founded_year', l: 'An înființare', t: 'number', min: 1800, max: 2100 },
      ],
    },
    event: {
      table: 'events',
      title: 'Creează un eveniment', submit: (v) => Events.create(v),
      fields: [
        { n: 'title', l: 'Titlu', req: 1, max: 200 },
        { n: 'description', l: 'Descriere', t: 'textarea', max: 3000 },
        { n: 'category', l: 'Categorie', t: 'select', o: OPT.eventCat, req: 1 },
        { n: 'starts_at', l: 'Data și ora începerii', t: 'datetime-local', req: 1, hint: 'Alege data și ora locală a evenimentului.' },
        { n: 'ends_at', l: 'Data și ora încheierii', t: 'datetime-local' },
        { n: 'is_online', l: 'Eveniment online', t: 'checkbox' },
        { n: 'venue', l: 'Locație / link de participare', max: 240 },
        { n: 'city', l: 'Localitate', max: 120 },
        { n: 'capacity', l: 'Număr maxim de participanți', t: 'number', min: 1 },
        { n: 'ngo_id', l: 'Organizator (opțional)', t: 'select', o: [], hint: 'Alege organizația pe care o reprezinți sau lasă necompletat pentru un eveniment independent.' },
      ],
      validate: (v) => v.ends_at && v.ends_at < v.starts_at ? 'Data de final trebuie să fie după început.' : (!v.is_online && !v.venue ? 'Adaugă o locație pentru evenimentul fizic.' : (!v.is_online && !v.city ? 'Adaugă localitatea evenimentului.' : null)),
    },
    collab: {
      table: 'collaborations',
      title: 'Publică o cerere de colaborare', submit: (v) => Collabs.create(v),
      fields: [
        { n: 'title', l: 'Titlu', req: 1, max: 200 },
        { n: 'type', l: 'Tip', t: 'select', o: OPT.collabType, req: 1 },
        { n: 'category', l: 'Categorie', t: 'select', o: OPT.ngoCat, req: 1 },
        { n: 'description', l: 'Descriere', t: 'textarea', req: 1, max: 3000 },
        { n: 'location', l: 'Locație' },
        { n: 'deadline', l: 'Termen limită', t: 'date' },
      ],
    },
    project: {
      table: 'projects',
      title: 'Adaugă un proiect', submit: (v) => run(supabase.from('projects').insert({ ...v, status: 'pending_review' }).select().single()),
      fields: [
        { n: 'title', l: 'Titlu proiect', req: 1, max: 200 },
        { n: 'ngo_id', l: 'Organizație responsabilă', t: 'select', o: [], req: 1 },
        { n: 'description', l: 'Descriere', t: 'textarea', max: 3000 },
        { n: 'lifecycle', l: 'Stare', t: 'select', o: [['planned', 'Planificat'], ['active', 'Activ'], ['completed', 'Finalizat'], ['cancelled', 'Anulat']], req: 1 },
        { n: 'starts_on', l: 'Data început', t: 'date' },
        { n: 'ends_on', l: 'Data sfârșit', t: 'date' },
      ],
      validate: (v) => v.ends_on && v.starts_on && v.ends_on < v.starts_on ? 'Data de sfârșit trebuie să fie după început.' : (v.ngo_id ? null : 'Alege organizația proiectului.'),
    },
    person: {
      table: 'people',
      title: 'Profil public de persoană', submit: (v) => run(supabase.from('people').insert({ ...v, status: 'pending_review' }).select().single()),
      fields: [
        { n: 'name', l: 'Nume', req: 1, max: 160 },
        { n: 'ngo_id', l: 'Organizație (opțional)', t: 'select', o: [] },
        { n: 'role', l: 'Rol / activitate' },
        { n: 'bio', l: 'Biografie', t: 'textarea', max: 2000 },
        { n: 'city', l: 'Oraș' },
        { n: 'public_contact', l: 'Contact public (opțional — vizibil tuturor)' },
      ],
    },
    resource: {
      table: 'resources',
      title: 'Propune o resursă', submit: (v) => Resources.submit(v),
      fields: [
        { n: 'title', l: 'Titlu', req: 1, max: 200 },
        { n: 'type', l: 'Tip', t: 'select', o: OPT.resType, req: 1 },
        { n: 'category', l: 'Categorie', t: 'select', o: OPT.eventCat, req: 1 },
        { n: 'description', l: 'Descriere', t: 'textarea', max: 2000 },
        { n: 'url', l: 'Link (https://…)', t: 'url', req: 1 },
      ],
    },
  };

  // ---------- stiluri minime (folosesc variabilele existente dacă există) ----------
  const css = document.createElement('style');
  css.textContent = `
  .ys-ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;padding:16px}
  .ys-md{background:var(--paper,#fbf7ef);color:var(--ink,#222);border-radius:14px;max-width:560px;width:100%;max-height:92vh;overflow:auto;padding:24px;font-family:inherit}
  .ys-md h2{font-family:var(--serif,Georgia,serif);margin:0 0 16px}
  .ys-f{display:flex;flex-direction:column;gap:4px;margin-bottom:12px;font-size:14px}
  .ys-f input,.ys-f select,.ys-f textarea{padding:9px 10px;border:1px solid #c9c0ae;border-radius:8px;font:inherit;background:#fff}
  .ys-f.ck{flex-direction:row;align-items:center;gap:8px}
  .ys-err{color:#b3261e;font-size:13px;min-height:16px}
  .ys-ft{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
  .ys-b{padding:9px 16px;border-radius:8px;border:1px solid #c9c0ae;background:transparent;cursor:pointer;font:inherit}
  .ys-b.pr{background:var(--accent,#2f5d50);color:#fff;border-color:transparent}
  .ys-b:disabled{opacity:.6;cursor:wait}
  .ys-row{border-bottom:1px solid #e5dfd0;padding:10px 0;display:flex;gap:8px;align-items:center;justify-content:space-between}
  .ys-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
  .ys-toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 18px;border-radius:8px;z-index:1100}`;
  document.head.appendChild(css);

  function toast(msg) {
    const t = document.createElement('div'); t.className = 'ys-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
  }

  function modal(html) {
    const ov = document.createElement('div'); ov.className = 'ys-ov';
    ov.innerHTML = `<div class="ys-md" role="dialog" aria-modal="true">${html}</div>`;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    return { ov, close, box: ov.firstElementChild };
  }

  async function needAuth() {
    const u = await currentUser();
    if (!u) toast('Trebuie să fii autentificat pentru această acțiune.');
    return u;
  }

  // ---------- randare câmp ----------
  function fieldHtml(f) {
    const id = 'ysf_' + f.n, req = f.req ? ' required' : '';
    const lab = `<label for="${id}">${esc(f.l)}${f.req ? ' *' : ''}</label>`;
    const hint = f.hint ? `<small class="field-hint">${esc(f.hint)}</small>` : '';
    if (f.t === 'checkbox') return `<div class="ys-f ck"><input type="checkbox" id="${id}" name="${f.n}"><label for="${id}">${esc(f.l)}</label>${hint}</div>`;
    let input;
    if (f.t === 'textarea') input = `<textarea id="${id}" name="${f.n}" rows="4"${f.max ? ` maxlength="${f.max}"` : ''}${req}></textarea>`;
    else if (f.t === 'select') {
      const opts = f.o.map((o) => Array.isArray(o) ? `<option value="${esc(o[0])}">${esc(o[1])}</option>` : `<option value="${esc(o)}">${esc(o)}</option>`).join('');
      input = `<select id="${id}" name="${f.n}"${req}><option value="">— alege —</option>${opts}</select>`;
    } else input = `<input id="${id}" name="${f.n}" type="${f.t || 'text'}"${f.max ? ` maxlength="${f.max}"` : ''}${f.min != null ? ` min="${f.min}"` : ''}${req}>`;
    return `<div class="ys-f">${lab}${input}${hint}</div>`;
  }

  // ---------- citire + normalizare valori ----------
  function readValues(form, fields) {
    const v = {};
    for (const f of fields) {
      const el = form.elements[f.n];
      if (f.t === 'checkbox') { v[f.n] = el.checked; continue; }
      let val = (el.value || '').trim();
      if (val === '') { v[f.n] = null; continue; }
      if (f.t === 'number') val = Number(val);
      else if (f.t === 'datetime-local') { const date = new Date(val); if (Number.isNaN(date.getTime())) throw new Error('Data introdusă nu este validă.'); val = date.toISOString(); }
      v[f.n] = val;
    }
    return v;
  }

  function prefill(form, fields, rec) {
    const loc = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
    for (const f of fields) {
      const el = form.elements[f.n], val = rec[f.n]; if (!el || val == null) continue;
      if (f.t === 'checkbox') el.checked = !!val;
      else if (f.t === 'datetime-local') el.value = loc(val);
      else el.value = val;
    }
  }

  // ---------- formular generic ----------
  async function openForm(kind, extra = {}, record = null) {
    const cfg = FORMS[kind]; if (!cfg) return;
    const user = await needAuth(); if (!user) return;
    if (cfg.fields.some(field => field.n === 'ngo_id')) {
      const [{ data: owned }, { data: memberships }] = await Promise.all([
        supabase.from('ngos').select('id,name').eq('created_by', user.id).order('name'),
        supabase.from('ngo_members').select('ngo_id').eq('user_id', user.id)
      ]);
      const memberIds = (Array.isArray(memberships) ? memberships : []).map(row => row.ngo_id);
      let memberOrgs = [];
      if (memberIds.length) {
        const result = await supabase.from('ngos').select('id,name').in('id', memberIds).order('name');
        memberOrgs = result.data || [];
      }
      const orgs = [...new Map([...(Array.isArray(owned) ? owned : []), ...memberOrgs].map(org => [org.id, org])).values()];
      const field = cfg.fields.find(field => field.n === 'ngo_id');
      field.o = orgs.map(org => [org.id, org.name]);
      if (!field.req) field.o.unshift(['', 'Fără organizație']);
    }
    const m = modal(`<h2>${esc(cfg.title)}</h2>
      <form novalidate>${cfg.fields.map(fieldHtml).join('')}
        <div class="ys-err" role="alert"></div>
        <div class="ys-ft"><button type="button" class="ys-b" data-x>Anulează</button><button class="ys-b pr">${record ? 'Salvează modificările' : 'Trimite spre aprobare'}</button></div>
      </form>`);
    const form = m.box.querySelector('form'), err = m.box.querySelector('.ys-err'), btn = form.querySelector('.pr');
    m.box.querySelector('[data-x]').onclick = m.close;
    if (record) prefill(form, cfg.fields, record);
    form.elements[cfg.fields[0].n].focus();
    const label = btn.textContent;

    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const bad = cfg.fields.find((f) => f.req && !form.elements[f.n].value.trim());
      if (bad) { err.textContent = `Câmpul „${bad.l}” este obligatoriu.`; form.elements[bad.n].focus(); return; }
      if (!form.checkValidity()) { err.textContent = 'Verifică valorile introduse.'; return; }
      let values;
      try { values = record ? readValues(form, cfg.fields) : { ...readValues(form, cfg.fields), ...extra }; }
      catch (error) { err.textContent = error.message || 'Verifică data introdusă.'; btn.disabled = false; btn.textContent = label; return; }
      if (record && extra.ngo_id) values.ngo_id = extra.ngo_id;
      const msg = cfg.validate && cfg.validate(values); if (msg) { err.textContent = msg; return; }
      btn.disabled = true; btn.textContent = 'Se trimite…';            // protecție la dublu-submit
      const { error } = record
        ? await run(supabase.from(cfg.table).update(values).eq('id', record.id))
        : await cfg.submit(values);
      if (error) { err.textContent = error; btn.disabled = false; btn.textContent = label; return; } // datele rămân în formular
      m.close(); toast(record ? 'Modificările au fost salvate.' : 'Trimis spre aprobare. Îl vei vedea public după verificare.');
      document.dispatchEvent(new CustomEvent('data:changed', { detail: { kind } }));
    });
  }

  async function openEdit(kind, id, extra = {}) {
    const cfg = FORMS[kind]; if (!cfg) return;
    const { data, error } = await run(supabase.from(cfg.table).select('*').eq('id', id).single());
    if (error || !data) { toast(error || 'Înregistrarea nu a fost găsită.'); return; }
    openForm(kind, extra, data);
  }

  // ---------- răspuns la colaborare ----------
  async function openCollabResponse(collabId, title = '') {
    if (!(await needAuth())) return;
    const m = modal(`<h2>Răspunde la: ${esc(title)}</h2><form novalidate>
      <div class="ys-f"><label for="ysr_t">Răspund ca</label><select id="ysr_t"><option>Organizație</option><option>Voluntar</option><option>Persoană fizică</option></select></div>
      <div class="ys-f"><label for="ysr_m">Mesaj *</label><textarea id="ysr_m" rows="5" maxlength="2000" required></textarea></div>
      <div class="ys-err" role="alert"></div>
      <div class="ys-ft"><button type="button" class="ys-b" data-x>Anulează</button><button class="ys-b pr">Trimite</button></div></form>`);
    m.box.querySelector('[data-x]').onclick = m.close;
    const form = m.box.querySelector('form'), err = m.box.querySelector('.ys-err'), btn = form.querySelector('.pr');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const message = form.querySelector('#ysr_m').value.trim();
      if (!message) { err.textContent = 'Scrie un mesaj.'; return; }
      btn.disabled = true;
      const { error } = await Collabs.respond(collabId, message, form.querySelector('#ysr_t').value);
      if (error) { err.textContent = error; btn.disabled = false; return; }
      m.close(); toast('Răspunsul a fost trimis.');   // succes doar după confirmarea serverului
      document.dispatchEvent(new CustomEvent('data:changed', { detail: { kind: 'collab_response' } }));
    });
  }

  // ---------- panou moderare (doar staff) ----------
  const MOD_TABLES = [['ngos', 'Organizații', 'name'], ['events', 'Evenimente', 'title'], ['collaborations', 'Colaborări', 'title'], ['resources', 'Resurse', 'title'], ['people', 'Persoane', 'name'], ['projects', 'Proiecte', 'title']];

  async function isStaff() {
    const u = await currentUser(); if (!u) return false;
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', u.id);
    return !!(data && data.length);
  }

  async function openModeration() {
    if (!(await isStaff())) { toast('Nu ai acces la moderare.'); return; }
    const m = modal(`<h2>Moderare</h2><div class="ys-tabs"></div><div data-list></div><div class="ys-ft"><button class="ys-b" data-x>Închide</button></div>`);
    m.box.querySelector('[data-x]').onclick = m.close;
    const tabs = m.box.querySelector('.ys-tabs'), list = m.box.querySelector('[data-list]');

    async function load(table, label, col) {
      list.innerHTML = 'Se încarcă…';
      const { data, error } = await Moderation.pending(table);
      if (error) { list.textContent = error; return; }
      if (!data.length) { list.innerHTML = `<p>Nu există ${esc(label.toLowerCase())} în așteptare.</p>`; return; }
      list.innerHTML = data.map((r) => `<div class="ys-row" data-id="${esc(r.id)}"><span>${esc(r[col])}</span>
        <span><button class="ys-b pr" data-a="ok">Aprobă</button> <button class="ys-b" data-a="no">Respinge</button></span></div>`).join('');
      list.onclick = async (e) => {
        const b = e.target.closest('button[data-a]'); if (!b) return;
        const id = b.closest('.ys-row').dataset.id; let res;
        if (b.dataset.a === 'ok') res = await Moderation.approve(table, id);
        else { const reason = prompt('Motivul respingerii (vizibil autorului):'); if (!reason) return; res = await Moderation.reject(table, id, reason); }
        if (res.error) { toast(res.error); return; }
        toast('Actualizat.'); load(table, label, col);
        document.dispatchEvent(new CustomEvent('data:changed', { detail: { kind: 'moderation' } }));
      };
    }
    MOD_TABLES.forEach(([t, l, c], i) => {
      const b = document.createElement('button'); b.className = 'ys-b'; b.textContent = l; b.onclick = () => load(t, l, c); tabs.appendChild(b);
      if (i === 0) load(t, l, c);
    });
  }

  // ---------- "Contribuțiile mele": stare + motiv respingere ----------
  async function myContributions() {
    const u = await needAuth(); if (!u) return [];
    const out = [];
    for (const [t, l, c] of MOD_TABLES) {
      const { data } = await supabase.from(t).select(`id, ${c}, status, rejection_reason`).eq('created_by', u.id);
      (data || []).forEach((r) => out.push({ table: t, label: l, id: r.id, name: r[c], status: r.status, reason: r.rejection_reason }));
    }
    return out;
  }

  window.YSForms = { openForm, openEdit, openCollabResponse, openModeration, myContributions, isStaff, toast };
})();