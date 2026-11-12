import { CONFIG } from './config.js';

// Une couleur par catégorie : [fond, texte].
const CATEGORY_COLORS = {
  'Apéritif': ['#f2b705', '#2f2a25'],
  'Entrée': ['#7a8f2a', '#ffffff'],
  'Plat': ['#c8553d', '#ffffff'],
  'Accompagnement': ['#9c6b3f', '#ffffff'],
  'Dessert': ['#d6336c', '#ffffff'],
  'Goûter': ['#e8751a', '#ffffff'],
  'Petit-déjeuner': ['#1c86d1', '#ffffff'],
  'Boisson': ['#6b4fbb', '#ffffff'],
};
const CATEGORIES = Object.keys(CATEGORY_COLORS);
const catStyle = (c) => (CATEGORY_COLORS[c] ? `style="--cat:${CATEGORY_COLORS[c][0]};--cat-ink:${CATEGORY_COLORS[c][1]}"` : '');
const FIELDS = ['title', 'category', 'tags', 'prep_minutes', 'cook_minutes', 'servings', 'ingredients', 'steps', 'notes', 'tiktok_ideas', 'tiktok_url'];

const app = document.getElementById('app');
const topActions = document.getElementById('top-actions');

const PERSON = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="18" r="8"/><path d="M8 42c2-9 9-13 16-13s14 4 16 13"/></svg>`;
const PLATE = `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="11"/><circle cx="24" cy="24" r="6"/><path d="M7 10v9a3 3 0 0 0 6 0v-9M10 10v28M41 38V10c-3 2-4 7-4 12h4"/></svg>`;

/* ---------- Outils ---------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lines = (s) => String(s ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
const duration = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + String(m % 60).padStart(2, '0') : ''}` : `${m} min`);
const totalTime = (r) => (r.prep_minutes || 0) + (r.cook_minutes || 0);
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : '');

// Réduit la photo avant de l'enregistrer, pour qu'elle reste légère.
function shrinkPhoto(file, maxSize) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('photo'))), 'image/jpeg', 0.82);
    };
    img.onerror = () => reject(new Error('photo'));
    img.src = url;
  });
}

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

/* ---------- Enregistrement : dans l'appareil (mode essai) ---------- */

const PROFILE_KEY = 'onmangequoi-profil';

function localStore() {
  const KEY = 'onmangequoi-recettes';
  const read = () => JSON.parse(localStorage.getItem(KEY) || '[]');
  const write = (all) => localStorage.setItem(KEY, JSON.stringify(all));
  return {
    local: true,
    photoSize: 900,
    async user() { return { id: 'local' }; },
    async list() { return read().map((r) => ({ ...r, photo: r.photo_data || null })); },
    async save(recipe, photoBlob) {
      const all = read();
      const row = { ...recipe };
      delete row.photo;
      if (photoBlob) row.photo_data = await blobToDataUrl(photoBlob);
      if (row.id) all[all.findIndex((r) => r.id === row.id)] = row;
      else all.push({ ...row, id: crypto.randomUUID() });
      write(all);
    },
    async remove(recipe) { write(read().filter((r) => r.id !== recipe.id)); },
    async getProfile() {
      const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      return { first_name: p.first_name || '', age: p.age ?? null, username: p.username || '', photo: p.photo_data || null };
    },
    async saveProfile(info, photoBlob) {
      const old = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
      const next = { ...old, ...info };
      if (photoBlob) next.photo_data = await blobToDataUrl(photoBlob);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    },
  };
}

/* ---------- Enregistrement : compte privé en ligne (Supabase) ---------- */

async function onlineStore() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  const sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  const check = ({ data, error }) => { if (error) throw error; return data; };
  const user = async () => (await sb.auth.getSession()).data.session?.user || null;
  return {
    local: false,
    photoSize: 1400,
    user,
    async signIn(email, password) { check(await sb.auth.signInWithPassword({ email, password })); },
    async signOut() { await sb.auth.signOut(); },
    async list() {
      const rows = check(await sb.from('recipes').select('*'));
      const paths = rows.map((r) => r.photo_path).filter(Boolean);
      const urls = {};
      if (paths.length) {
        for (const s of check(await sb.storage.from('photos').createSignedUrls(paths, 6 * 3600))) urls[s.path] = s.signedUrl;
      }
      return rows.map((r) => ({ ...r, photo: urls[r.photo_path] || null }));
    },
    async save(recipe, photoBlob) {
      const row = {};
      for (const f of FIELDS) row[f] = recipe[f];
      row.updated_at = new Date().toISOString();
      let oldPhoto = null;
      if (photoBlob) {
        const path = `${(await user()).id}/${crypto.randomUUID()}.jpg`;
        check(await sb.storage.from('photos').upload(path, photoBlob, { contentType: 'image/jpeg' }));
        oldPhoto = recipe.photo_path || null;
        row.photo_path = path;
      }
      if (recipe.id) check(await sb.from('recipes').update(row).eq('id', recipe.id));
      else check(await sb.from('recipes').insert(row));
      if (oldPhoto) await sb.storage.from('photos').remove([oldPhoto]);
    },
    async remove(recipe) {
      check(await sb.from('recipes').delete().eq('id', recipe.id));
      if (recipe.photo_path) await sb.storage.from('photos').remove([recipe.photo_path]);
    },
    // Le profil est gardé dans le compte lui-même (rien de plus à régler dans Supabase).
    async getProfile() {
      const u = await user();
      const m = u?.user_metadata || {};
      let photo = null;
      if (m.avatar_path) {
        const { data } = await sb.storage.from('photos').createSignedUrl(m.avatar_path, 6 * 3600);
        photo = data?.signedUrl || null;
      }
      return { first_name: m.first_name || '', age: m.age ?? null, username: m.username || '', photo };
    },
    async saveProfile(info, photoBlob) {
      const meta = { ...info };
      let oldPhoto = null;
      if (photoBlob) {
        const u = await user();
        const path = `${u.id}/profil-${crypto.randomUUID()}.jpg`;
        check(await sb.storage.from('photos').upload(path, photoBlob, { contentType: 'image/jpeg' }));
        oldPhoto = u.user_metadata?.avatar_path || null;
        meta.avatar_path = path;
      }
      check(await sb.auth.updateUser({ data: meta }));
      if (oldPhoto) await sb.storage.from('photos').remove([oldPhoto]);
    },
    // On vérifie d'abord l'ancien mot de passe, puis on enregistre le nouveau.
    async changePassword(current, next) {
      const u = await user();
      check(await sb.auth.signInWithPassword({ email: u.email, password: current }));
      check(await sb.auth.updateUser({ password: next }));
    },
  };
}

/* ---------- État ---------- */

let store;
let recipes = [];
let profile = { first_name: '', age: null, username: '', photo: null };
const filter = { category: '', tag: '' };

async function reload() {
  recipes = (await store.list()).sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  profile = await store.getProfile().catch(() => profile);
}

/* ---------- Menu (trois traits) ---------- */

const menuBtn = document.getElementById('menu-btn');
const drawer = document.getElementById('drawer');
const shade = document.getElementById('drawer-shade');
const openSections = new Set();
const allTags = () => [...new Set(recipes.flatMap((r) => r.tags || []))].sort((a, b) => a.localeCompare(b, 'fr'));

function openMenu() {
  renderMenu();
  shade.hidden = false;
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  drawer.classList.add('open');
  menuBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  drawer.querySelector('.drawer-close')?.focus();
}

function closeMenu() {
  shade.hidden = true;
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  drawer.classList.remove('open');
  menuBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
}

// Choisit un filtre depuis le menu puis revient à la liste.
function pick(kind, value) {
  if (kind === 'all') { filter.category = ''; filter.tag = ''; }
  else filter[kind] = filter[kind] === value ? '' : value;
  closeMenu();
  if (location.hash === '#/' || location.hash === '') showList();
  else location.hash = '#/';
}

function renderMenu() {
  const count = (c) => recipes.filter((r) => r.category === c).length;
  const tags = allTags();
  const who = profile.username || profile.first_name;
  // Chaque titre du menu ouvre ou ferme sa liste (toutes fermées au départ).
  const section = (key, title, content) => `
    <section class="drawer-section">
      <button class="drawer-toggle" type="button" data-section="${key}" aria-expanded="${openSections.has(key)}" aria-controls="menu-${key}">${title}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></button>
      <div class="drawer-panel" id="menu-${key}" ${openSections.has(key) ? '' : 'hidden'}>${content}</div>
    </section>`;
  drawer.innerHTML = `
    <div class="drawer-head">
      <h2>Menu</h2>
      <button class="menu-btn drawer-close" type="button" aria-label="Fermer le menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
    </div>
    ${who ? `<a class="drawer-me" href="#/profil"><span class="avatar small">${profile.photo ? `<img src="${esc(profile.photo)}" alt="">` : PERSON}</span><strong>${esc(who)}</strong></a>` : ''}
    ${section('carnet', 'Mon carnet', `
      <ul class="drawer-list">
        <li><button class="drawer-link ${!filter.category && !filter.tag ? 'on' : ''}" data-kind="all">Toutes les recettes<span class="count">${recipes.length}</span></button></li>
        <li><a class="drawer-link" href="#/nouvelle">+ Nouvelle recette</a></li>
      </ul>`)}
    ${section('categories', 'Catégories', `
      <ul class="drawer-list">${CATEGORIES.map((c) => `
        <li><button class="drawer-link ${filter.category === c ? 'on' : ''}" ${catStyle(c)} data-kind="category" data-value="${esc(c)}"><span class="dot"></span>${esc(c)}<span class="count">${count(c)}</span></button></li>`).join('')}
      </ul>`)}
    ${section('etiquettes', 'Étiquettes', tags.length ? `<div class="chips">${tags.map((t) => `<button class="chip ${filter.tag === t ? 'on' : ''}" data-kind="tag" data-value="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : `<p class="muted">Pas encore d'étiquette. Ajoute-en dans une recette.</p>`)}
    <section class="drawer-section"><a class="drawer-link ${location.hash === '#/profil' ? 'on' : ''}" href="#/profil">Mon profil</a></section>
    ${store && !store.local ? `<section class="drawer-section"><button class="btn" id="logout">Se déconnecter</button></section>` : ''}`;
  drawer.querySelector('.drawer-close').addEventListener('click', closeMenu);
  drawer.querySelectorAll('.drawer-toggle').forEach((b) => b.addEventListener('click', () => {
    const key = b.dataset.section;
    const open = !openSections.has(key);
    if (open) openSections.add(key); else openSections.delete(key);
    b.setAttribute('aria-expanded', open);
    document.getElementById(`menu-${key}`).hidden = !open;
  }));
  drawer.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => pick(b.dataset.kind, b.dataset.value)));
  drawer.querySelector('a[href="#/nouvelle"]').addEventListener('click', closeMenu);
  drawer.querySelectorAll('a[href="#/profil"]').forEach((a) => a.addEventListener('click', closeMenu));
  drawer.querySelector('#logout')?.addEventListener('click', async () => { closeMenu(); await store.signOut(); profile = { first_name: '', age: null, username: '', photo: null }; showLogin(); });
}

menuBtn.addEventListener('click', () => (drawer.classList.contains('open') ? closeMenu() : openMenu()));

// Safari sur iPhone/iPad n'applique l'effet « enfoncé » (:active) que si la page écoute le toucher.
document.addEventListener('touchstart', () => {}, { passive: true });

// Un toucher sur le logo ou le titre ramène toujours à la liste de toutes les recettes.
document.querySelector('.brand').addEventListener('click', (e) => {
  closeMenu();
  filter.category = '';
  filter.tag = '';
  // Déjà sur la liste (la barre d'adresse ne change pas) : on la réaffiche sans filtre.
  if ((location.hash === '#/' || location.hash === '') && app.querySelector('.grid, .empty, .active-filters')) {
    e.preventDefault();
    window.scrollTo(0, 0);
    showList();
  }
});
shade.addEventListener('click', closeMenu);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });

/* ---------- Écrans ---------- */

function showLogin() {
  topActions.innerHTML = '';
  menuBtn.hidden = true;
  app.innerHTML = `
    <form class="login" id="login">
      <h1 class="form-title">Bienvenue en cuisine</h1>
      <label>Adresse e-mail <input type="email" name="email" autocomplete="username" required></label>
      <label>Mot de passe <input type="password" name="password" autocomplete="current-password" required></label>
      <button class="btn primary">Se connecter</button>
      <p class="error" id="login-error" hidden></p>
    </form>`;
  document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    try {
      await store.signIn(data.get('email'), data.get('password'));
    } catch (err) {
      console.error(err);
      const box = document.getElementById('login-error');
      const text = String(err?.message || err || '');
      let message = 'La connexion n\'a pas fonctionné.';
      if (/invalid login credentials/i.test(text)) message = 'Adresse e-mail ou mot de passe incorrect.';
      else if (/not confirmed/i.test(text)) message = 'Cette adresse e-mail n\'est pas encore confirmée dans Supabase.';
      else if (/fetch|network|load failed/i.test(text) || err?.status === 0) message = 'Impossible de joindre le compte en ligne. Vérifie ta connexion Internet.';
      else if (/api key|apikey|jwt/i.test(text)) message = 'La clé du compte en ligne est refusée.';
      box.textContent = text && message !== 'Adresse e-mail ou mot de passe incorrect.' ? `${message} (${text})` : message;
      box.hidden = false;
      return;
    }
    // Connecté : on ouvre le carnet. Une panne ici n'est pas un mauvais mot de passe.
    try {
      await reload();
      route();
    } catch (err) {
      console.error(err);
      app.innerHTML = `<p class="error">Le carnet n'a pas pu s'ouvrir. Vérifie ta connexion Internet puis recharge la page.</p>`;
    }
  });
}

function showList() {
  topActions.innerHTML = '';
  if (!allTags().includes(filter.tag)) filter.tag = '';
  const shown = recipes.filter((r) => (!filter.category || r.category === filter.category) && (!filter.tag || (r.tags || []).includes(filter.tag)));
  const active = (kind, value) => `<button class="chip on" ${kind === 'category' ? catStyle(value) : ''} data-kind="${kind}" aria-label="Retirer le filtre ${esc(value)}">${esc(value)} <span aria-hidden="true">✕</span></button>`;

  const notice = store.local ? `<p class="notice">Mode essai : les recettes sont enregistrées uniquement sur cet appareil.</p>` : '';
  if (!recipes.length) {
    app.innerHTML = `${notice}<div class="empty"><img src="logo.svg" alt=""><h2>Le carnet est encore vide</h2><p>Ajoute ta première idée de recette.</p><a class="btn primary" href="#/nouvelle">+ Nouvelle recette</a></div>`;
    return;
  }
  app.innerHTML = `${notice}
    ${filter.category || filter.tag ? `<div class="active-filters"><span class="muted">Filtre :</span>${filter.category ? active('category', filter.category) : ''}${filter.tag ? active('tag', filter.tag) : ''}</div>` : ''}
    ${shown.length ? `<div class="grid">${shown.map((r) => `
      <a class="card" href="#/recette/${r.id}" ${catStyle(r.category)}>
        <div class="thumb">${r.photo ? `<img src="${esc(r.photo)}" alt="" loading="lazy">` : PLATE}</div>
        <div class="card-body">
          <p class="card-title">${esc(r.title)}</p>
          <p class="card-meta">${r.category ? `<span class="pill">${esc(r.category)}</span>` : ''}${totalTime(r) ? `<span>${duration(totalTime(r))}</span>` : ''}</p>
        </div>
      </a>`).join('')}</div>` : `<p class="muted">Aucune recette ne correspond à ces filtres.</p>`}
`;
  app.querySelectorAll('.active-filters .chip').forEach((b) => b.addEventListener('click', () => {
    filter[b.dataset.kind] = '';
    showList();
  }));
}

function showRecipe(r) {
  topActions.innerHTML = `<a class="btn" href="#/modifier/${r.id}">Modifier</a>`;
  const fact = (label, value) => (value ? `<div><dt>${label}</dt><dd>${esc(value)}</dd></div>` : '');
  const facts = fact('Temps de préparation', r.prep_minutes ? duration(r.prep_minutes) : '') + fact('Cuisson', r.cook_minutes ? duration(r.cook_minutes) : '') + fact('Portions', r.servings);
  const link = safeUrl(r.tiktok_url);
  app.innerHTML = `
    <article class="recipe" ${catStyle(r.category)}>
      <a class="back" href="#/">‹ Toutes les recettes</a>
      <header class="banner ${r.photo ? 'has-photo' : ''}">
        ${r.photo ? `<img class="banner-img" src="${esc(r.photo)}" alt="">` : `<span class="banner-icon">${PLATE}</span>`}
        <label class="banner-photo-btn">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>
          <span id="banner-photo-label">${r.photo ? 'Changer la photo' : 'Ajouter une photo'}</span>
          <input type="file" accept="image/*" id="banner-photo">
        </label>
        <div class="banner-text">
          <h1>${esc(r.title)}</h1>
          <ul class="tags">${r.category ? `<li class="cat">${esc(r.category)}</li>` : ''}${(r.tags || []).map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>
      </header>
      <p class="error" id="photo-error" hidden>La photo n'a pas pu être enregistrée. Réessaie dans un instant.</p>
      ${facts ? `<dl class="facts">${facts}</dl>` : ''}
      <div class="cols">
        <section class="col-card"><h2>Ingrédients</h2>${lines(r.ingredients).length ? `<ul>${lines(r.ingredients).map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : `<p class="muted">À compléter.</p>`}</section>
        <section class="col-card"><h2>Préparation</h2>${lines(r.steps).length ? `<ol>${lines(r.steps).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>` : `<p class="muted">À compléter.</p>`}</section>
      </div>
      ${r.notes ? `<section><h2>Notes perso</h2><p class="text">${esc(r.notes)}</p></section>` : ''}
      ${r.tiktok_ideas || link ? `<section class="tiktok"><h2>TikTok</h2>
        ${r.tiktok_ideas ? `<p class="text">${esc(r.tiktok_ideas)}</p>` : ''}
        ${link ? `<p><a class="btn" href="${esc(link)}" target="_blank" rel="noopener">Voir la vidéo</a></p>` : ''}</section>` : ''}
    </article>`;

  // Ajouter ou changer la photo de la bannière directement depuis la fiche.
  document.getElementById('banner-photo').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const label = document.getElementById('banner-photo-label');
    label.textContent = 'Enregistrement…';
    try {
      await store.save(r, await shrinkPhoto(file, store.photoSize));
      await reload();
      showRecipe(recipes.find((x) => x.id === r.id));
    } catch (err) {
      console.error(err);
      label.textContent = r.photo ? 'Changer la photo' : 'Ajouter une photo';
      document.getElementById('photo-error').hidden = false;
    }
  });
}

function showProfile(saved) {
  topActions.innerHTML = '';
  const p = profile;
  app.innerHTML = `
    <div class="narrow profile">
      <a class="back" href="#/">‹ Toutes les recettes</a>
      <h1 class="form-title">Mon profil</h1>
      <form id="profile-form">
        <div class="avatar-row">
          <div class="avatar" id="avatar-view">${p.photo ? `<img src="${esc(p.photo)}" alt="">` : PERSON}</div>
          <label class="btn file-btn"><span id="avatar-label">${p.photo ? 'Changer la photo' : 'Ajouter une photo'}</span><input type="file" name="photo" accept="image/*"></label>
        </div>
        <label>Prénom <input name="first_name" autocomplete="given-name" value="${esc(p.first_name)}"></label>
        <label>Âge <input name="age" type="number" inputmode="numeric" min="0" max="120" value="${esc(p.age)}"></label>
        <label>Nom d'utilisateur <small>Le nom qui s'affiche dans le menu. Tu te connectes toujours avec ton adresse e-mail.</small>
          <input name="username" autocapitalize="none" autocomplete="off" value="${esc(p.username)}"></label>
        <p class="error" id="profile-error" hidden>Le profil n'a pas pu être enregistré. Réessaie dans un instant.</p>
        <p class="ok" id="profile-ok" role="status" ${saved ? '' : 'hidden'}>Profil enregistré ✓</p>
        <div class="btn-row"><button class="btn primary" id="profile-save">Enregistrer</button></div>
      </form>
      ${store.local ? `<p class="notice">Mode essai : le mot de passe se change dans le compte en ligne, pas ici.</p>` : `
      <form id="password-form" class="password-form">
        <h2>Changer mon mot de passe</h2>
        <label>Mot de passe actuel <input name="current" type="password" autocomplete="current-password" required></label>
        <label>Nouveau mot de passe <small>8 caractères au minimum</small><input name="next" type="password" autocomplete="new-password" minlength="8" required></label>
        <label>Retape le nouveau mot de passe <input name="again" type="password" autocomplete="new-password" minlength="8" required></label>
        <p class="error" id="password-error" hidden></p>
        <p class="ok" id="password-ok" role="status" hidden>Mot de passe changé ✓</p>
        <div class="btn-row"><button class="btn" id="password-save">Changer mon mot de passe</button></div>
      </form>`}
    </div>`;

  const form = document.getElementById('profile-form');
  form.elements.photo.addEventListener('change', () => {
    const file = form.elements.photo.files[0];
    if (!file) return;
    document.getElementById('avatar-view').innerHTML = `<img src="${URL.createObjectURL(file)}" alt="">`;
    document.getElementById('avatar-label').textContent = 'Photo choisie';
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const button = document.getElementById('profile-save');
    button.disabled = true;
    button.textContent = 'Enregistrement…';
    document.getElementById('profile-error').hidden = true;
    document.getElementById('profile-ok').hidden = true;
    try {
      const age = form.elements.age.value.trim();
      const info = {
        first_name: form.elements.first_name.value.trim(),
        age: age === '' ? null : Math.min(120, Math.max(0, parseInt(age, 10) || 0)),
        username: form.elements.username.value.trim(),
      };
      const file = form.elements.photo.files[0];
      await store.saveProfile(info, file && file.size ? await shrinkPhoto(file, 600) : null);
      profile = await store.getProfile();
      showProfile(true);
    } catch (err) {
      console.error(err);
      document.getElementById('profile-error').hidden = false;
      button.disabled = false;
      button.textContent = 'Enregistrer';
    }
  });

  document.getElementById('password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const error = document.getElementById('password-error');
    const ok = document.getElementById('password-ok');
    const button = document.getElementById('password-save');
    error.hidden = true;
    ok.hidden = true;
    if (f.elements.next.value !== f.elements.again.value) {
      error.textContent = 'Les deux nouveaux mots de passe ne sont pas identiques.';
      error.hidden = false;
      return;
    }
    button.disabled = true;
    button.textContent = 'Enregistrement…';
    try {
      await store.changePassword(f.elements.current.value, f.elements.next.value);
      f.reset();
      ok.hidden = false;
    } catch (err) {
      console.error(err);
      const text = String(err?.message || err || '');
      if (/invalid login credentials/i.test(text)) error.textContent = 'Le mot de passe actuel n\'est pas le bon.';
      else if (/different from the old/i.test(text)) error.textContent = 'Choisis un mot de passe différent de l\'ancien.';
      else if (/at least|weak|short/i.test(text)) error.textContent = 'Ce mot de passe est trop court ou trop simple.';
      else error.textContent = 'Le mot de passe n\'a pas pu être changé. Réessaie dans un instant.';
      error.hidden = false;
    }
    button.disabled = false;
    button.textContent = 'Changer mon mot de passe';
  });
}

function showForm(r) {
  topActions.innerHTML = '';
  const v = r || { tags: [] };
  app.innerHTML = `
    <form id="recipe-form" class="narrow">
      <a class="back" href="${r ? `#/recette/${r.id}` : '#/'}">‹ Annuler</a>
      <h1 class="form-title">${r ? 'Modifier la recette' : 'Nouvelle recette'}</h1>
      <label>Titre <input name="title" required value="${esc(v.title)}"></label>
      <label>Catégorie
        <select name="category"><option value="">Sans catégorie</option>${CATEGORIES.map((c) => `<option ${v.category === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </label>
      <label>Étiquettes <small>Séparées par des virgules : rapide, végétarien, hiver…</small>
        <input name="tags" autocapitalize="none" value="${esc((v.tags || []).join(', '))}"></label>
      <div class="row3">
        <label>Temps de préparation <small>en minutes</small><input name="prep_minutes" type="number" inputmode="numeric" min="0" value="${esc(v.prep_minutes)}"></label>
        <label>Cuisson <small>en minutes</small><input name="cook_minutes" type="number" inputmode="numeric" min="0" value="${esc(v.cook_minutes)}"></label>
        <label>Portions <small>ex. 4 personnes</small><input name="servings" value="${esc(v.servings)}"></label>
      </div>
      <label>Photo de la bannière <small>Elle s'affiche en grand en haut de la recette</small>
        ${v.photo ? `<img class="photo-preview" src="${esc(v.photo)}" alt="">` : ''}
        <input name="photo" type="file" accept="image/*"></label>
      <label>Ingrédients <small>Un par ligne</small><textarea name="ingredients">${esc(v.ingredients)}</textarea></label>
      <label>Préparation <small>Une étape par ligne</small><textarea name="steps">${esc(v.steps)}</textarea></label>
      <label>Notes perso <small>Astuces, variantes, idées…</small><textarea name="notes">${esc(v.notes)}</textarea></label>
      <fieldset>
        <legend>TikTok</legend>
        <label>Idées de tournage<textarea name="tiktok_ideas">${esc(v.tiktok_ideas)}</textarea></label>
        <label>Lien de la vidéo <small>Une fois publiée</small><input name="tiktok_url" type="url" inputmode="url" placeholder="https://" value="${esc(v.tiktok_url)}"></label>
      </fieldset>
      <p class="error" id="form-error" hidden>L'enregistrement n'a pas fonctionné. Réessaie dans un instant.</p>
      <div class="btn-row">
        <button class="btn primary" id="save">Enregistrer</button>
        ${r ? `<button class="btn danger" type="button" id="delete">Supprimer la recette</button>` : ''}
      </div>
    </form>`;

  const form = document.getElementById('recipe-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const text = (name) => String(data.get(name) || '').trim();
    const number = (name) => (text(name) === '' ? null : Math.max(0, parseInt(text(name), 10) || 0));
    const recipe = {
      ...(r || {}),
      title: text('title'),
      category: text('category'),
      tags: [...new Set(text('tags').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))],
      prep_minutes: number('prep_minutes'),
      cook_minutes: number('cook_minutes'),
      servings: text('servings'),
      ingredients: text('ingredients'),
      steps: text('steps'),
      notes: text('notes'),
      tiktok_ideas: text('tiktok_ideas'),
      tiktok_url: text('tiktok_url'),
    };
    const button = document.getElementById('save');
    button.disabled = true;
    button.textContent = 'Enregistrement…';
    try {
      const file = data.get('photo');
      const photo = file && file.size ? await shrinkPhoto(file, store.photoSize) : null;
      await store.save(recipe, photo);
      await reload();
      location.hash = r ? `#/recette/${r.id}` : '#/';
    } catch (err) {
      console.error(err);
      document.getElementById('form-error').hidden = false;
      button.disabled = false;
      button.textContent = 'Enregistrer';
    }
  });
  document.getElementById('delete')?.addEventListener('click', async () => {
    if (!confirm(`Supprimer « ${r.title} » ? Cette action est définitive.`)) return;
    try {
      await store.remove(r);
      await reload();
      location.hash = '#/';
    } catch (err) {
      console.error(err);
      document.getElementById('form-error').hidden = false;
    }
  });
}

/* ---------- Navigation ---------- */

function route() {
  menuBtn.hidden = false;
  const [, page, id] = location.hash.split('/');
  const recipe = recipes.find((r) => r.id === id);
  window.scrollTo(0, 0);
  if (page === 'nouvelle') showForm(null);
  else if (page === 'profil') showProfile();
  else if (page === 'modifier' && recipe) showForm(recipe);
  else if (page === 'recette' && recipe) showRecipe(recipe);
  else showList();
}

async function start() {
  try {
    store = CONFIG.supabaseUrl ? await onlineStore() : localStore();
    if (!(await store.user())) return showLogin();
    await reload();
    route();
  } catch (err) {
    console.error(err);
    app.innerHTML = `<p class="error">Le carnet n'a pas pu s'ouvrir. Vérifie ta connexion Internet puis recharge la page.</p>`;
  }
}

window.addEventListener('hashchange', async () => {
  if (store && (await store.user())) route();
});
start();
