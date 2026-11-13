/* Optional account access — public browsing stays available without registration. */
(() => {
  const client = () => window.supabaseClient;
  let profile = null;
  let user = null;

  const initials = (name) => (String(name || 'Cont utilizator').trim().split(/\s+/).slice(0,2).map(x => x[0] || '').join('').toUpperCase() || 'CU');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function identity() {
    const name = profile?.display_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Cont utilizator';
    return { name, initials: initials(name), role: profile?.profile_type || 'membru', email: user?.email || '' };
  }

  function updateShell() {
    const who = identity();
    const action = document.getElementById('auth-action');
    const name = document.getElementById('side-user-name');
    const meta = document.getElementById('side-user-meta');
    const avatar = document.getElementById('side-avatar');
    const sideAction = document.getElementById('side-account-action');
    if (action) action.textContent = user ? 'Contul meu' : 'Intră / creează cont';
    if (name) name.textContent = user ? who.name : 'Vizitator';
    if (meta) meta.textContent = user ? who.email : 'Explorezi fără cont';
    if (avatar) avatar.textContent = user ? who.initials : 'V';
    if (sideAction) sideAction.textContent = user ? 'Setări cont' : 'Creează cont gratuit';
  }

  async function refresh() {
    try {
      const { data } = await client().auth.getSession();
      user = data?.session?.user || null;
      profile = null;
      if (user) {
        const result = await client().from('profiles').select('display_name,profile_type').eq('id', user.id).maybeSingle();
        profile = result.data || null;
      }
    } catch (error) {
      console.warn('Account profile unavailable:', error);
    }
    updateShell();
    return user;
  }

  function close() {
    document.getElementById('overlay')?.classList.remove('open');
    document.getElementById('modal-content').innerHTML = '';
  }

  function open(mode = 'signup', message = '') {
    const content = document.getElementById('modal-content');
    if (!content) return;
    const signup = mode !== 'login';
    content.innerHTML = `
      <div class="auth-intro">
        <span class="auth-kicker">Bine Comun · Bucovina</span>
        <h2>${signup ? 'Creează-ți un cont' : 'Bine ai revenit'}</h2>
        <p>${signup ? 'Contul este opțional. Poți explora platforma fără să te înregistrezi; ai nevoie de cont doar pentru contribuții și funcțiile personale.' : 'Autentifică-te pentru a-ți gestiona contribuțiile și activitatea.'}</p>
      </div>
      ${message ? `<div class="auth-notice" role="status">${escapeHtml(message)}</div>` : ''}
      <form id="auth-form" class="auth-form" novalidate>
        ${signup ? '<div class="field"><label for="auth-name">Nume afișat</label><input id="auth-name" name="name" autocomplete="name" maxlength="120" required placeholder="Cum te numești?"></div>' : ''}
        <div class="field"><label for="auth-email">Adresă de email</label><input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="nume@exemplu.ro"></div>
        <div class="field"><label for="auth-password">Parolă</label><input id="auth-password" name="password" type="password" minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}" required placeholder="Minimum 8 caractere"></div>
        <p class="auth-error" id="auth-error" role="alert"></p>
        <button class="btn primary auth-submit" type="submit">${signup ? 'Creează cont' : 'Autentifică-te'}</button>
      </form>
      <p class="auth-switch">${signup ? 'Ai deja cont?' : 'Nu ai încă un cont?'} <button type="button" class="auth-link" id="auth-switch">${signup ? 'Autentifică-te' : 'Creează cont gratuit'}</button></p>
      <p class="auth-foot">Înregistrarea nu este necesară pentru a consulta organizațiile, evenimentele și resursele publice.</p>`;
    document.getElementById('overlay')?.classList.add('open');
    document.getElementById('auth-switch').onclick = () => open(signup ? 'login' : 'signup');
    const form = document.getElementById('auth-form');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const error = document.getElementById('auth-error');
      const submit = form.querySelector('[type="submit"]');
      error.textContent = '';
      if (!form.reportValidity()) return;
      const email = form.elements.email.value.trim();
      const password = form.elements.password.value;
      submit.disabled = true;
      submit.textContent = signup ? 'Se creează contul…' : 'Se verifică…';
      try {
        if (signup) {
          const name = form.elements.name.value.trim();
          if (!name) throw new Error('Introdu numele afișat.');
          const { data, error: authError } = await client().auth.signUp({
            email, password,
            options: { data: { name }, emailRedirectTo: window.location.origin }
          });
          if (authError) throw authError;
          if (!data.session) {
            open('login', 'Contul a fost creat. Verifică emailul pentru confirmare, apoi autentifică-te.');
            return;
          }
        } else {
          const { error: authError } = await client().auth.signInWithPassword({ email, password });
          if (authError) throw authError;
        }
        await refresh();
        close();
        window.dispatchEvent(new CustomEvent('ys:auth-changed'));
      } catch (err) {
        error.textContent = err.message || 'Nu am putut finaliza autentificarea. Încearcă din nou.';
        submit.disabled = false;
        submit.textContent = signup ? 'Creează cont' : 'Autentifică-te';
      }
    });
    document.getElementById('auth-email')?.focus();
  }

  async function openAccount() {
    await refresh();
    if (!user) return open('signup');
    const who = identity();
    document.getElementById('modal-content').innerHTML = `
      <div class="auth-intro"><span class="auth-kicker">Cont personal</span><h2>${escapeHtml(who.name)}</h2><p>${escapeHtml(who.email)}</p></div>
      <div class="account-actions">
        <button class="btn" type="button" id="account-contributions">Contribuțiile mele</button>
        <button class="btn" type="button" id="account-signout">Deconectează-te</button>
      </div>`;
    document.getElementById('overlay')?.classList.add('open');
    document.getElementById('account-contributions').onclick = async () => {
      const rows = await window.YSForms?.myContributions?.() || [];
      const status = { pending_review: 'În verificare', published: 'Publicat', rejected: 'Necesită modificări', draft: 'Ciornă' };
      const list = rows.length ? rows.map(x => `<div class="account-contribution"><b>${escapeHtml(x.name)}</b><span>${escapeHtml(status[x.status] || x.status)}</span>${x.reason ? `<small>${escapeHtml(x.reason)}</small>` : ''}</div>`).join('') : '<p class="auth-foot">Nu ai încă nicio contribuție.</p>';
      document.getElementById('modal-content').innerHTML = `<div class="auth-intro"><h2>Contribuțiile mele</h2><p>Starea propunerilor trimise platformei.</p></div>${list}<button class="btn" id="account-back">Înapoi</button>`;
      document.getElementById('account-back').onclick = openAccount;
    };
    document.getElementById('account-signout').onclick = async () => {
      const { error } = await client().auth.signOut();
      if (error) { window.YSForms?.toast(error.message); return; }
      await refresh(); close(); window.dispatchEvent(new CustomEvent('ys:auth-changed'));
    };
  }

  document.addEventListener('DOMContentLoaded', refresh);
  client().auth.onAuthStateChange(() => { window.setTimeout(() => refresh().then(() => window.dispatchEvent(new CustomEvent('ys:auth-changed'))), 0); });
  window.YSAuth = { open, openAccount, refresh, identity, getUser: () => user };
})();
