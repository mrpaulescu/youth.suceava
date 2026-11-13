// Strat de acces la date — Youth Suceava
// Alias compatibil cu supabase.js din repository și cu testele jsdom.
const supabase = window.supabaseClient || window.supabase;
// Toate funcțiile returnează { data, error } normalizat; UI-ul arată succes DOAR când error === null.

async function run(promise) {
  try {
    const { data, error } = await promise;
    if (error) { console.error('[Supabase]', error); return { data: null, error: humanize(error) }; }
    return { data, error: null };
  } catch (e) {
    console.error('[Supabase]', e);
    return { data: null, error: 'Eroare de rețea. Încearcă din nou.' };
  }
}

function humanize(err) {
  if (err.code === '23505') return 'Această acțiune a fost deja efectuată.';
  if (err.code === '42501' || /row-level security/i.test(err.message || '')) return 'Nu ai permisiunea pentru această acțiune.';
  if (err.code === '23514') return 'Datele introduse nu sunt valide.';
  return 'A apărut o eroare. Încearcă din nou.';
}

async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

// ---------- Feed ----------
const Feed = {
  list: (limit = 20, from = 0) =>
    run(supabase.from('posts')
      .select('*, author:profiles!posts_author_id_fkey(display_name, avatar_url)')
      .eq('status', 'published').order('created_at', { ascending: false })
      .range(from, from + limit - 1)),
  stats: (ids) => run(supabase.from('post_stats').select('*').in('post_id', ids)),
  create: (body, extra = {}) => run(supabase.from('posts').insert({ body: body.trim(), ...extra }).select().single()),
  remove: (id) => run(supabase.from('posts').delete().eq('id', id)),
  comments: (postId) => run(supabase.from('comments')
    .select('*, author:profiles!comments_user_id_fkey(display_name, avatar_url)')
    .eq('post_id', postId).eq('status', 'published').order('created_at')),
  addComment: (postId, body) => run(supabase.from('comments').insert({ post_id: postId, body: body.trim() }).select().single()),
  like: (postId) => run(supabase.from('post_likes').insert({ post_id: postId })),
  unlike: async (postId) => { const u = await currentUser(); if (!u) return { data: null, error: 'Trebuie să fii autentificat.' }; return run(supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', u.id)); },
};

// ---------- Colaborări ----------
const Collabs = {
  create: (c) => run(supabase.from('collaborations').insert({ ...c, status: 'pending_review' }).select().single()),
  respond: (collaborationId, message, respondentType) =>
    run(supabase.from('collaboration_responses').insert({ collaboration_id: collaborationId, message, respondent_type: respondentType })),
  responsesFor: (collaborationId) => run(supabase.from('collaboration_responses').select('*').eq('collaboration_id', collaborationId)),
};

// ---------- Evenimente ----------
const Events = {
  create: (e) => run(supabase.from('events').insert({ ...e, status: 'pending_review' }).select().single()),
  register: (eventId, fullName, email) => run(supabase.from('event_registrations').insert({ event_id: eventId, full_name: fullName, email })),
  unregister: async (eventId) => { const u = await currentUser(); if (!u) return { data: null, error: 'Trebuie să fii autentificat.' }; return run(supabase.from('event_registrations').delete().eq('event_id', eventId).eq('user_id', u.id)); },
};

// ---------- Organizații ----------
const Ngos = {
  submit: (n) => run(supabase.from('ngos').insert({ ...n, status: 'pending_review' }).select().single()),
  update: (id, patch) => run(supabase.from('ngos').update(patch).eq('id', id).select().single()),
};

// ---------- Resurse ----------
const Resources = {
  submit: (r) => run(supabase.from('resources').insert({ ...r, status: 'pending_review' }).select().single()),
};

// ---------- Notificări ----------
const Notifications = {
  unread: () => run(supabase.from('notifications').select('*').is('read_at', null).order('created_at', { ascending: false })),
  markAllRead: () => run(supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)),
};

// ---------- Moderare (doar staff; RLS impune oricum) ----------
const Moderation = {
  pending: (table) => run(supabase.from(table).select('*').eq('status', 'pending_review').order('created_at')),
  approve: (table, id) => run(supabase.from(table).update({ status: 'published', rejection_reason: null }).eq('id', id)),
  reject: (table, id, reason) => run(supabase.from(table).update({ status: 'rejected', rejection_reason: reason }).eq('id', id)),
};

// ---------- Utilitar anti-XSS pentru template strings / innerHTML ----------
function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Storage (convenție: <user_id>/<fișier>) ----------
const Storage = {
  // bucket: 'avatars' | 'ngo-logos' | 'event-images' | 'resource-files'
  async upload(bucket, file) {
    const u = await currentUser(); if (!u) return { data: null, error: 'Trebuie să fii autentificat.' };
    const limits = { avatars: 2, 'ngo-logos': 2, 'event-images': 5, 'resource-files': 15 };
    if (file.size > limits[bucket] * 1024 * 1024) return { data: null, error: `Fișierul depășește ${limits[bucket]} MB.` };
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${u.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { contentType: file.type, upsert: false });
    if (error) { console.error('[Storage]', error); return { data: null, error: 'Încărcarea a eșuat (tip sau dimensiune nepermise).' }; }
    return { data: { path, url: supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl }, error: null };
  },
};

// ---------- Liste paginate, cu filtrare/căutare pe server ----------
// Ex: Directory.list('ngos', { page: 0, size: 12, category: 'Mediu', search: 'tineri', searchCol: 'name', order: ['name', true] })
const Directory = {
  async list(table, { page = 0, size = 12, search = '', searchCol = 'name', filters = {}, order = ['created_at', false], select = '*' } = {}) {
    let q = supabase.from(table).select(select, { count: 'exact' }).eq('status', 'published');
    for (const [k, v] of Object.entries(filters)) if (v != null && v !== '') q = q.eq(k, v);
    const term = search.trim().replace(/[%,()]/g, ' ');
    if (term) q = q.ilike(searchCol, `%${term}%`);
    q = q.order(order[0], { ascending: order[1] }).range(page * size, page * size + size - 1);
    const { data, error, count } = await q;
    if (error) { console.error('[Directory]', error); return { data: null, error: humanize(error), total: 0 }; }
    return { data, error: null, total: count ?? 0, hasMore: (page + 1) * size < (count ?? 0) };
  },
  // Metrici dashboard = numărători reale, fără offset-uri
  async counts() {
    const tables = ['ngos', 'events', 'collaborations', 'people', 'funding_opportunities', 'resources'];
    const out = {};
    await Promise.all(tables.map(async (t) => {
      const { count, error } = await supabase.from(t).select('id', { count: 'exact', head: true }).eq('status', 'published');
      out[t] = error ? null : count;   // null = indisponibil (UI afișează „—”, nu 0)
    }));
    return out;
  },
};