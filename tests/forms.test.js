// Teste unitare pentru data.js + forms.js (jsdom + mock Supabase). Rulează: npm run test:unit
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setup({ user = { id: 'u1' }, respond = () => ({ data: {}, error: null }) } = {}) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously', pretendToBeVisual: true });
  const w = dom.window, calls = [];
  const builder = (table) => {
    const b = { table, op: 'select' };
    for (const m of ['select', 'eq', 'single', 'order', 'is', 'in', 'range', 'ilike', 'insert', 'update', 'delete']) {
      b[m] = (...a) => { if (['insert', 'update', 'delete'].includes(m)) { b.op = m; b.payload = a[0]; } if (m === 'eq') (b.eqs ||= []).push(a); return b; };
    }
    b.then = (res, rej) => { calls.push({ table, op: b.op, payload: b.payload, eqs: b.eqs }); return Promise.resolve(respond(b)).then(res, rej); };
    return b;
  };
  w.supabase = { auth: { getUser: async () => ({ data: { user } }) }, from: builder };
  for (const f of ['data.js', 'forms.js']) {            // ca <script> în pagină: const/let partajate global
    const el = w.document.createElement('script');
    el.textContent = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
    w.document.body.appendChild(el);
  }
  return { w, doc: w.document, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 20));

test('esc() neutralizează HTML', () => {
  const { w } = setup();
  assert.equal(w.escapeHTML('<img src=x onerror=alert(1)>"'), '&lt;img src=x onerror=alert(1)&gt;&quot;');
});

test('utilizator neautentificat: nu se deschide formularul', async () => {
  const { w, doc } = setup({ user: null });
  await w.YSForms.openForm('ngo');
  assert.equal(doc.querySelector('.ys-md'), null);
  assert.match(doc.querySelector('.ys-toast').textContent, /autentificat/);
});

test('câmp obligatoriu lipsă: eroare și nicio scriere', async () => {
  const { w, doc, calls } = setup();
  await w.YSForms.openForm('ngo');
  doc.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await tick();
  assert.match(doc.querySelector('.ys-err').textContent, /obligatoriu/);
  assert.equal(calls.filter((c) => c.op === 'insert').length, 0);
});

test('succes: insert cu status pending_review, modal închis, eveniment emis', async () => {
  const { w, doc, calls } = setup();
  let fired = null; doc.addEventListener('data:changed', (e) => (fired = e.detail));
  await w.YSForms.openForm('ngo');
  const f = doc.querySelector('form');
  f.elements.name.value = 'ONG Test'; f.elements.category.value = 'Mediu'; f.elements.founded_year.value = '2015';
  f.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await tick();
  const ins = calls.find((c) => c.op === 'insert');
  assert.equal(ins.table, 'ngos');
  assert.equal(ins.payload.status, 'pending_review');
  assert.equal(ins.payload.name, 'ONG Test');
  assert.equal(ins.payload.founded_year, 2015);
  assert.equal(ins.payload.website, null);       // câmpuri goale -> null
  assert.equal(doc.querySelector('.ys-md'), null);
  assert.deepEqual({ ...fired }, { kind: 'ngo' });
});

test('eroare de server: mesaj afișat, datele păstrate, buton reactivat', async () => {
  const { w, doc } = setup({ respond: () => ({ data: null, error: { code: '42501', message: 'row-level security' } }) });
  await w.YSForms.openForm('collab');
  const f = doc.querySelector('form');
  f.elements.title.value = 'Caut voluntari'; f.elements.type.value = 'volunteer'; f.elements.description.value = 'Detalii';
  f.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await tick();
  assert.match(doc.querySelector('.ys-err').textContent, /permisiunea/);
  assert.equal(f.elements.title.value, 'Caut voluntari');
  assert.equal(f.querySelector('.pr').disabled, false);
});

test('editare: precompletare + update după id, fără status', async () => {
  const rec = { id: 'e1', title: 'Atelier', category: 'edu', starts_at: '2026-12-01T10:00:00Z', is_online: true, capacity: 30 };
  const { w, doc, calls } = setup({ respond: (b) => (b.op === 'select' ? { data: rec, error: null } : { data: {}, error: null }) });
  await w.YSForms.openEdit('event', 'e1');
  await tick();
  const f = doc.querySelector('form');
  assert.equal(f.elements.title.value, 'Atelier');
  assert.equal(f.elements.is_online.checked, true);
  assert.equal(f.elements.capacity.value, '30');
  f.elements.title.value = 'Atelier nou';
  f.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await tick();
  const up = calls.find((c) => c.op === 'update');
  assert.equal(up.payload.title, 'Atelier nou');
  assert.ok(!('status' in up.payload));
  assert.deepEqual(up.eqs[0], ['id', 'e1']);
});

test('eveniment: data de final înainte de început este respinsă', async () => {
  const { w, doc, calls } = setup();
  await w.YSForms.openForm('event');
  const f = doc.querySelector('form');
  f.elements.title.value = 'X'; f.elements.category.value = 'edu'; f.elements.starts_at.value = '2026-12-02T10:00'; f.elements.ends_at.value = '2026-12-01T10:00';
  f.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await tick();
  assert.match(doc.querySelector('.ys-err').textContent, /după început/);
  assert.equal(calls.filter((c) => c.op === 'insert').length, 0);
});

test('răspuns la colaborare: succes doar după confirmarea serverului', async () => {
  const { w, doc, calls } = setup();
  await w.YSForms.openCollabResponse('c1', 'Titlu');
  doc.querySelector('#ysr_m').value = 'Pot ajuta';
  doc.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
  await tick();
  const ins = calls.find((c) => c.table === 'collaboration_responses');
  assert.equal(ins.payload.collaboration_id, 'c1');
  assert.match(doc.querySelector('.ys-toast').textContent, /trimis/);
});