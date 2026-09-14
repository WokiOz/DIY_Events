const BLOCK_TYPES = {
  note: {
    label: 'Note', glyph: '📝', hint: 'Une idée, un rappel',
    fields: [{ key: 'texte', label: 'Note', type: 'textarea' }]
  },
  image: {
    label: 'Image', glyph: '🖼️', hint: 'Photo ou inspiration',
    fields: [
      { key: 'images', label: 'Images', type: 'images' },
      { key: 'legende', label: 'Légende', type: 'text' }
    ]
  },
  libre: {
    label: 'Champ libre', glyph: '✎', hint: 'À vous d’inventer',
    fields: [{ key: 'contenu', label: 'Contenu', type: 'textarea' }]
  },
  checklist: {
    label: 'Liste à cocher', glyph: '☑', hint: 'Ce qu’il reste à faire',
    fields: [{ key: 'taches', label: 'À faire', type: 'checklist' }]
  },
  recette: {
    label: 'Recette de cuisine', glyph: '🍰', hint: 'Gâteau, buffet, boissons',
    fields: [
      { key: 'image', label: 'Photo', type: 'image' },
      { key: 'portions', label: 'Pour combien de personnes', type: 'text' },
      { key: 'ingredients', label: 'Ingrédients (un par ligne)', type: 'list' },
      { key: 'etapes', label: 'Préparation', type: 'textarea' }
    ]
  },
  deco: {
    label: 'Plan de décoration', glyph: '🎈', hint: 'Couleurs, ambiance, matériel',
    fields: [
      { key: 'image', label: 'Inspiration', type: 'image' },
      { key: 'couleurs', label: 'Couleurs', type: 'text' },
      { key: 'materiel', label: 'Matériel (un par ligne)', type: 'list' },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },
  print3d: {
    label: 'Impression 3D', glyph: '🧊', hint: 'Fichier, réglages, matière',
    fields: [
      { key: 'image', label: 'Aperçu', type: 'image' },
      { key: 'fichier', label: 'Fichier 3D', type: 'file' },
      { key: 'matiere', label: 'Matière', type: 'text' },
      { key: 'reglages', label: 'Réglages', type: 'textarea' }
    ]
  },
  document: {
    label: 'Document', glyph: '📎', hint: 'Devis, contrat, plan',
    fields: [
      { key: 'fichier', label: 'Fichier', type: 'file' },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },
  prestataire: {
    label: 'Prestataire', glyph: '🤝', hint: 'Traiteur, salle, photographe',
    fields: [
      { key: 'nom', label: 'Nom', type: 'text' },
      { key: 'telephone', label: 'Téléphone', type: 'text' },
      { key: 'courriel', label: 'Courriel', type: 'text' },
      { key: 'prix', label: 'Prix annoncé', type: 'text' },
      { key: 'notes', label: 'Notes', type: 'textarea' }
    ]
  },
  planning: {
    label: 'Déroulé', glyph: '🕒', hint: 'Le programme heure par heure',
    fields: [{ key: 'etapes', label: 'Étapes (une par ligne)', type: 'list' }]
  },
  lien: {
    label: 'Lien', glyph: '🔗', hint: 'Une page à retrouver',
    fields: [
      { key: 'url', label: 'Adresse', type: 'text' },
      { key: 'notes', label: 'Pourquoi ce lien', type: 'textarea' }
    ]
  },
  renvoi: {
    label: 'Élément lié', glyph: '🔁', hint: 'Réutiliser une recette, un prestataire d’un autre événement',
    fields: [{ key: 'event_id', label: 'Événement lié', type: 'renvoi' }]
  }
};

/* ------------------------------------------------------------ outillage */

const esc = valeur => String(valeur ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const minuteurs = {};
function debounce(cle, fn, delai = 500) {
  clearTimeout(minuteurs[cle]);
  minuteurs[cle] = setTimeout(fn, delai);
}

async function api(methode, url, corps) {
  const options = { method: methode, headers: {} };
  if (corps !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(corps);
  }
  const reponse = await fetch(url, options);
  if (reponse.status === 401) {
    afficherConnexion();
    throw new Error('Session expirée, reconnectez-vous.');
  }
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(donnees?.error || 'Erreur du serveur');
  return donnees;
}
const get = url => api('GET', url);
const post = (url, corps) => api('POST', url, corps);
const patch = (url, corps) => api('PATCH', url, corps);
const supprimer = url => api('DELETE', url);

/* ---------------------------------------------------------------- accès */

async function connexion(nom, motDePasse) {
  const reponse = await fetch('/api/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: nom, password: motDePasse })
  });
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) throw new Error(donnees?.error || 'Connexion impossible');
  return donnees;
}

function afficherConnexion() {
  ecranMdp.hidden = true;
  ecranConnexion.hidden = false;
  document.getElementById('co-identifiant')?.focus();
}

function afficherEcranMdp() {
  ecranConnexion.hidden = true;
  ecranMdp.hidden = false;
  document.getElementById('mdp-nouveau')?.focus();
}

function renderCompte() {
  if (!state.user) { zoneCompte.hidden = true; return; }
  zoneCompte.hidden = false;
  zoneCompte.innerHTML = `
    <span class="nom">${esc(state.user.username)}</span>
    <span class="role">${estAdmin() ? 'Admin' : 'Lecture seule'}</span>
    ${estAdmin() ? '<button class="icone" data-action="voir-comptes">Comptes</button>' : ''}
    <button class="icone" data-action="deconnexion">Se déconnecter</button>`;
}

function appliquerModeLecture() {
  if (estAdmin()) return;
  document.querySelectorAll('#vue [data-action]:not([data-lecture-ok])').forEach(el => el.remove());
  document.querySelectorAll('#vue input, #vue textarea, #vue select').forEach(el => {
    if (el.type === 'checkbox' || el.type === 'radio') el.disabled = true;
    else el.readOnly = true;
  });
}

async function demarrerApplication() {
  ecranConnexion.hidden = true;
  ecranMdp.hidden = true;
  renderCompte();
  await rechargerOnglets();
  route();
}

const argent = valeur => Number(valeur || 0).toLocaleString('fr-FR', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 2
});

const dateFr = valeur => valeur
  ? new Date(valeur).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '';

const vide = texte => `<p class="vide">${esc(texte)}</p>`;

function motDePasseAleatoire(longueur = 10) {
  // sans caractères ambigus (0/O, 1/l/I) pour rester lisible une fois noté à la main
  const caracteres = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const octets = new Uint32Array(longueur);
  crypto.getRandomValues(octets);
  return Array.from(octets, o => caracteres[o % caracteres.length]).join('');
}

const rail = document.getElementById('rail');
const vue = document.getElementById('vue');
const dialogue = document.getElementById('dialogue');
const dialogueForm = document.getElementById('dialogue-form');
const zoneCompte = document.getElementById('zone-compte');
const ecranConnexion = document.getElementById('ecran-connexion');
const formConnexion = document.getElementById('form-connexion');
const erreurConnexion = document.getElementById('erreur-connexion');
const ecranMdp = document.getElementById('ecran-mdp');
const formMdp = document.getElementById('form-mdp');
const erreurMdp = document.getElementById('erreur-mdp');

const state = { tabs: [], event: null, user: null };
const estAdmin = () => state.user?.role === 'admin';

/* ------------------------------------------------------------- dialogue */

function demander(titre, champs) {
  return new Promise(resolve => {
    dialogueForm.innerHTML = `
      <h2>${esc(titre)}</h2>
      ${champs.map(champ => `<label>${esc(champ.label)}
        ${champ.type === 'textarea'
          ? `<textarea name="${esc(champ.key)}" rows="3">${esc(champ.value || '')}</textarea>`
          : `<input name="${esc(champ.key)}" type="${esc(champ.type || 'text')}" value="${esc(champ.value || '')}">`}
      </label>`).join('')}
      <div class="dialogue-actions">
        <button class="btn" value="ok">Valider</button>
        <button class="btn-plat" value="annuler">Annuler</button>
      </div>`;
    dialogue.returnValue = '';
    dialogue.addEventListener('close', () => {
      if (dialogue.returnValue !== 'ok') return resolve(null);
      const valeurs = {};
      for (const champ of champs) valeurs[champ.key] = dialogueForm.elements[champ.key].value.trim();
      resolve(valeurs);
    }, { once: true });
    dialogue.showModal();
    dialogueForm.querySelector('input, textarea')?.focus();
  });
}

function choisirEvenementLie() {
  return new Promise(resolve => {
    let choisi = null;
    dialogueForm.innerHTML = `
      <h2>Lier un événement</h2>
      <p class="sous">Cherchez par nom — la recette, le thème ou le prestataire à réutiliser ici.</p>
      <input type="search" id="champ-recherche-lien" autocomplete="off" placeholder="Tarte, traiteur…">
      <p class="aide-recherche">Tapez au moins 3 lettres.</p>
      <div class="recherche-resultats" id="resultats-lien"></div>
      <div class="dialogue-actions">
        <button class="btn-plat" value="annuler">Annuler</button>
      </div>`;
    const champ = dialogueForm.querySelector('#champ-recherche-lien');
    const zone = dialogueForm.querySelector('#resultats-lien');

    champ.addEventListener('input', () => {
      const q = champ.value.trim();
      if (q.length < 3) { zone.innerHTML = ''; return; }
      debounce('recherche-lien', async () => {
        const trouves = await get(`/api/search?q=${encodeURIComponent(q)}`).catch(() => []);
        zone.innerHTML = trouves.length
          ? trouves.map((e, i) => `
            <button type="button" class="recherche-resultat" data-index="${i}">
              <span class="badge">${esc(e.theme_name)}</span>
              <span class="nom">${esc(e.name)}</span>
            </button>`).join('')
          : '<p class="recherche-vide">Aucun événement ne correspond.</p>';
        zone.querySelectorAll('.recherche-resultat').forEach(bouton => {
          bouton.addEventListener('click', () => {
            choisi = trouves[Number(bouton.dataset.index)];
            dialogue.close('ok');
          });
        });
      }, 250);
    });

    dialogue.returnValue = '';
    dialogue.addEventListener('close', () => resolve(dialogue.returnValue === 'ok' ? choisi : null), { once: true });
    dialogue.showModal();
    champ.focus();
  });
}

async function chargerApercusRenvoi() {
  for (const noeud of document.querySelectorAll('.renvoi-carte[data-renvoi-vers]')) {
    const eventId = noeud.dataset.renvoiVers;
    try {
      const cible = await get(`/api/events/${eventId}`);
      const infos = [dateFr(cible.event_date), cible.location, cible.guests ? `${cible.guests} invités` : '']
        .filter(Boolean).join(' · ');
      noeud.innerHTML = `
        <div class="renvoi-tete">
          <div class="renvoi-vignette">${cible.image_url ? `<img src="${esc(cible.image_url)}" alt="">` : '✦'}</div>
          <div>
            <div class="renvoi-badge">${esc(cible.theme?.name || '')}</div>
            <div class="renvoi-nom">${esc(cible.name)}</div>
          </div>
        </div>
        ${infos ? `<div class="renvoi-meta">${esc(infos)}</div>` : ''}
        <div class="renvoi-pied"><a class="renvoi-lien" href="#/event/${cible.id}">Voir l’événement complet →</a></div>`;
    } catch {
      noeud.innerHTML = `<p class="renvoi-introuvable">Cet événement n’est plus accessible.</p>`;
    }
  }
}

function focusVersPourcentages(focus) {
  const m = /^(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%$/.exec(focus || '');
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 50, y: 50 };
}

// pas de recadrage destructif : on choisit juste le point à garder visible
// (object-position), la photo d'origine n'est jamais retouchée.
function ouvrirRecadrage({ imageUrl, focus, ratioApercu, largeurApercu }) {
  return new Promise(resolve => {
    let position = focusVersPourcentages(focus);
    dialogueForm.innerHTML = `
      <h2>Recadrer la photo</h2>
      <p class="sous">Cliquez (ou glissez) sur la photo pour choisir la partie à garder visible.</p>
      <div class="recadrage-zone" id="zone-recadrage" style="background-image:url('${esc(imageUrl)}')">
        <div class="recadrage-marqueur" id="marqueur-recadrage"></div>
      </div>
      <div class="recadrage-previsu">
        <div class="cadre-apercu" id="apercu-recadrage"
             style="background-image:url('${esc(imageUrl)}'); aspect-ratio:${ratioApercu}; width:${largeurApercu}px"></div>
        <span class="legende">Aperçu tel qu’affiché sur le site</span>
      </div>
      <div class="dialogue-actions">
        <button class="btn" type="button" id="valider-recadrage">Enregistrer</button>
        <button class="btn-plat" value="annuler">Annuler</button>
      </div>`;

    const zone = dialogueForm.querySelector('#zone-recadrage');
    const marqueur = dialogueForm.querySelector('#marqueur-recadrage');
    const apercu = dialogueForm.querySelector('#apercu-recadrage');

    function actualiser() {
      marqueur.style.left = position.x + '%';
      marqueur.style.top = position.y + '%';
      apercu.style.backgroundPosition = `${position.x}% ${position.y}%`;
    }
    function depuisEvenement(e) {
      const rect = zone.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
      position = {
        x: Math.max(0, Math.min(100, Math.round((cx / rect.width) * 100))),
        y: Math.max(0, Math.min(100, Math.round((cy / rect.height) * 100)))
      };
      actualiser();
    }
    let enGlissement = false;
    const surPointerUp = () => { enGlissement = false; };
    zone.addEventListener('pointerdown', e => { enGlissement = true; depuisEvenement(e); });
    zone.addEventListener('pointermove', e => { if (enGlissement) depuisEvenement(e); });
    window.addEventListener('pointerup', surPointerUp);
    actualiser();

    dialogueForm.querySelector('#valider-recadrage').addEventListener('click', () => {
      dialogue.close(`${position.x}% ${position.y}%`);
    });

    dialogue.returnValue = '';
    dialogue.addEventListener('close', () => {
      window.removeEventListener('pointerup', surPointerUp);
      resolve(dialogue.returnValue && dialogue.returnValue !== 'annuler' ? dialogue.returnValue : null);
    }, { once: true });
    dialogue.showModal();
  });
}

async function envoyerFichier(fichier, nom) {
  const formulaire = new FormData();
  formulaire.append('file', fichier, nom);
  const reponse = await fetch('/api/upload', { method: 'POST', body: formulaire });
  const donnees = await reponse.json().catch(() => null);
  if (!reponse.ok) {
    alert(donnees?.error || 'L’envoi du fichier a échoué.');
    return null;
  }
  return donnees;
}

function choisirFichier(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.onchange = () => {
      const fichier = input.files[0];
      if (!fichier) return resolve(null);
      envoyerFichier(fichier, fichier.name).then(resolve);
    };
    input.click();
  });
}

function choisirFichiers(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    if (accept) input.accept = accept;
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

/* -------------------------------------------------------------- routage */

async function route() {
  const [, type, id] = (location.hash.slice(1) || '/').split('/');
  try {
    if (type === 'comptes') return await viewComptes();
    if (type === 'theme') return await viewTheme(id);
    if (type === 'event') return await viewEvent(id);
    if (type === 'tab') return await viewTab(id);
    const premier = state.tabs[0];
    if (premier) return location.replace(`#/tab/${premier.id}`);
    renderTabs(null);
    vue.innerHTML = vide(estAdmin()
      ? 'Créez un premier onglet pour commencer.'
      : 'Aucun événement ne vous a été partagé pour l’instant.');
  } catch (erreur) {
    vue.innerHTML = vide(erreur.message);
  }
}

function renderTabs(actif) {
  rail.innerHTML = state.tabs.map(onglet => `
    <a class="onglet${String(onglet.id) === String(actif) ? ' actif' : ''}" href="#/tab/${onglet.id}">
      ${onglet.image_url ? `<img src="${esc(onglet.image_url)}" alt="">` : ''}
      <span>${esc(onglet.name)}</span>
    </a>`).join('') +
    (estAdmin() ? '<button class="onglet ajout" data-action="onglet-ajouter">+ Nouvel onglet</button>' : '');
}

async function rechargerOnglets() {
  state.tabs = await get('/api/tabs');
}

/* ----------------------------------------------------------- vue onglet */

async function viewTab(id) {
  const themes = await get(`/api/tabs/${id}/themes`);
  const onglet = state.tabs.find(t => String(t.id) === String(id));
  renderTabs(id);
  vue.innerHTML = `
    <div class="entete">
      <div>
        <h1>${esc(onglet?.name || 'Onglet')}</h1>
        <p class="sous">${themes.length} thème${themes.length > 1 ? 's' : ''}</p>
      </div>
      ${estAdmin() ? `<div class="entete-actions">
        <button class="btn-plat" data-action="onglet-modifier" data-id="${id}">Modifier l’onglet</button>
        <button class="btn-plat danger" data-action="onglet-supprimer" data-id="${id}">Supprimer l’onglet</button>
        <button class="btn" data-action="theme-ajouter" data-id="${id}">+ Nouveau thème</button>
      </div>` : ''}
    </div>
    <div class="grille">${themes.map(carteTheme).join('')}</div>
    ${themes.length ? '' : vide('Aucun thème pour l’instant.')}`;
  appliquerModeLecture();
}

const carteTheme = theme => `
  <a class="carte" href="#/theme/${theme.id}">
    <div class="visuel">${theme.image_url ? `<img src="${esc(theme.image_url)}" alt=""${theme.image_focus ? ` style="object-position:${esc(theme.image_focus)}"` : ''}>` : '✦'}</div>
    <div class="corps">
      <h3>${esc(theme.name)}</h3>
      ${theme.description ? `<p>${esc(theme.description)}</p>` : ''}
      <p class="compte">${theme.event_count} événement${theme.event_count > 1 ? 's' : ''}</p>
    </div>
  </a>`;

/* ------------------------------------------------------------ vue thème */

async function viewTheme(id) {
  const theme = await get(`/api/themes/${id}`);
  renderTabs(theme.tab_id);
  vue.innerHTML = `
    <p class="fil"><a href="#/tab/${theme.tab_id}">← Retour</a></p>
    <div class="entete">
      <div>
        <h1>${esc(theme.name)}</h1>
        ${theme.description ? `<p class="sous">${esc(theme.description)}</p>` : ''}
      </div>
      ${estAdmin() ? `<div class="entete-actions">
        <button class="btn-plat" data-action="theme-image" data-id="${theme.id}">${theme.image_url ? 'Changer la photo' : 'Ajouter une photo'}</button>
        ${theme.image_url ? `<button class="btn-plat" data-action="theme-image-recadrer" data-id="${theme.id}">🎯 Recadrer</button>` : ''}
        ${theme.image_url ? `<button class="btn-plat danger" data-action="theme-image-retirer" data-id="${theme.id}">Retirer la photo</button>` : ''}
        <button class="btn-plat" data-action="theme-modifier" data-id="${theme.id}">Modifier le thème</button>
        <button class="btn-plat danger" data-action="theme-supprimer" data-id="${theme.id}">Supprimer le thème</button>
        <button class="btn" data-action="event-ajouter" data-id="${theme.id}">+ Nouvel événement</button>
      </div>` : ''}
    </div>
    <div class="grille">${theme.events.map(carteEvent).join('')}</div>
    ${theme.events.length ? '' : vide('Aucun événement dans ce thème.')}`;
  appliquerModeLecture();
}

function carteEvent(evenement) {
  const budget = Number(evenement.budget || 0);
  const depense = Number(evenement.spent || 0);
  const infos = [dateFr(evenement.event_date), evenement.location, evenement.guests ? `${evenement.guests} invités` : '']
    .filter(Boolean).join(' · ');
  return `
    <a class="carte" href="#/event/${evenement.id}">
      <div class="visuel">${evenement.image_url ? `<img src="${esc(evenement.image_url)}" alt=""${evenement.image_focus ? ` style="object-position:${esc(evenement.image_focus)}"` : ''}>` : '✦'}</div>
      <div class="corps">
        <h3>${esc(evenement.name)}</h3>
        ${infos ? `<p>${esc(infos)}</p>` : ''}
        ${budget ? `<p class="${depense > budget ? 'depasse' : 'compte'}">${argent(depense)} sur ${argent(budget)}</p>` : ''}
        ${evenement.labels?.length ? `<div class="labels-rangee">
          ${evenement.labels.map(l => `<span class="label-chip">${esc(l)}</span>`).join('')}
        </div>` : ''}
      </div>
    </a>`;
}

/* ----------------------------------------------------------- vue comptes */

async function viewComptes() {
  if (!estAdmin()) { location.hash = '#/'; return; }
  renderTabs(null);
  const [comptes, arborescence] = await Promise.all([get('/api/users'), chargerArborescence()]);
  vue.innerHTML = `
    <p class="fil"><a href="#/">← Retour</a></p>
    <div class="entete">
      <div><h1>Comptes</h1><p class="sous">Comptes administrateurs et comptes lecture seule de la famille.</p></div>
    </div>

    <form class="formulaire-compte" id="form-nouveau-compte">
      <div><label for="nc-nom">Identifiant</label><input id="nc-nom" name="username" type="text" required></div>
      <div>
        <div class="champ-event-tete">
          <label for="nc-mdp">Mot de passe</label>
          <button type="button" class="icone" data-action="compte-mdp-aleatoire">Aléatoire</button>
        </div>
        <input id="nc-mdp" name="password" type="password" required minlength="4">
      </div>
      <button class="btn" type="submit">+ Créer un compte lecture seule</button>
    </form>

    <div class="comptes-liste">${comptes.map(compte => renderCompteLigne(compte)).join('')}</div>`;

  document.getElementById('form-nouveau-compte').addEventListener('submit', async e => {
    e.preventDefault();
    const formulaire = e.target;
    try {
      await post('/api/users', { username: formulaire.username.value.trim(), password: formulaire.password.value });
      await viewComptes();
    } catch (erreur) {
      signaler(erreur);
    }
  });
}

async function chargerArborescence() {
  const onglets = await get('/api/tabs');
  const resultat = [];
  for (const onglet of onglets) {
    const themes = await get(`/api/tabs/${onglet.id}/themes`);
    for (const theme of themes) {
      const detail = await get(`/api/themes/${theme.id}`);
      resultat.push({ tab: onglet, theme: detail });
    }
  }
  return resultat;
}

function renderCompteLigne(compte) {
  if (compte.role === 'admin') {
    return `
      <div class="compte-ligne">
        <div class="entete-compte"><h3>${esc(compte.username)}</h3><span class="role">Admin</span></div>
      </div>`;
  }
  return `
    <div class="compte-ligne${compte.active ? '' : ' revoque'}">
      <div class="entete-compte">
        <h3>${esc(compte.username)}</h3>
        ${compte.active ? '' : '<span class="etiquette-revoque">Révoqué</span>'}
        <button class="icone" data-action="compte-permissions" data-id="${compte.id}">Gérer les événements visibles</button>
        <button class="icone" data-action="compte-basculer" data-id="${compte.id}" data-actif="${compte.active}">
          ${compte.active ? 'Révoquer' : 'Réactiver'}
        </button>
        <button class="icone danger" data-action="compte-supprimer" data-id="${compte.id}">Supprimer</button>
      </div>
      <div class="permissions-arbre" data-permissions="${compte.id}" hidden></div>
    </div>`;
}

/* -------------------------------------------------------- vue événement */

const CHAMPS_EVENT = [
  { champ: 'event_date', label: 'Date', input: 'date', glyph: '📅', hint: 'Quand ça a lieu' },
  { champ: 'location', label: 'Lieu', input: 'text', glyph: '📍', hint: 'Où ça se passe' },
  { champ: 'guests', label: 'Invités', input: 'number', glyph: '👥', hint: 'Combien de personnes' }
];
const CHAMP_DESCRIPTION = { champ: 'description', label: 'Description', glyph: '📝', hint: 'Notes libres' };
const CHAMP_BUDGET = { champ: 'budget', label: 'Budget', glyph: '💰', hint: 'Suivi des dépenses' };

function renderChampsEvent(evenement) {
  return CHAMPS_EVENT.map(({ champ, label, input }) => {
    if (evenement.champsCaches.has(champ)) return '';
    const valeur = champ === 'event_date' ? (evenement.event_date || '').slice(0, 10) : (evenement[champ] ?? '');
    return `
      <div>
        <div class="champ-event-tete">
          <label for="c-${champ}">${label}</label>
          <button type="button" class="icone" data-action="event-champ-retirer" data-champ="${champ}" title="Retirer ce champ">✕</button>
        </div>
        <input id="c-${champ}" type="${input}" ${input === 'number' ? 'min="0"' : ''}
               data-save="event" data-field="${champ}" value="${esc(valeur)}">
      </div>`;
  }).join('');
}

function renderDescriptionEvent(evenement) {
  if (evenement.champsCaches.has('description')) return '';
  return `
    <div class="champ-event-tete">
      <label for="c-desc">Description</label>
      <button type="button" class="icone" data-action="event-champ-retirer" data-champ="description" title="Retirer ce champ">✕</button>
    </div>
    <textarea id="c-desc" data-save="event" data-field="description">${esc(evenement.description || '')}</textarea>`;
}

function renderLabelsEvent(evenement) {
  const labels = evenement.labels || [];
  return `
    <div class="labels-champ">
      <label>Labels</label>
      <div class="labels-rangee">
        ${labels.map(l => `
          <span class="label-chip">${esc(l)}<button type="button" data-action="label-retirer" data-label="${esc(l)}" title="Retirer">✕</button></span>`).join('')}
        ${estAdmin() ? `<span class="label-ajout">
          <input type="text" id="champ-nouveau-label" placeholder="+ Ajouter" autocomplete="off">
          <span class="label-suggestions" id="suggestions-label"></span>
        </span>` : ''}
      </div>
    </div>`;
}

function redessinerLabelsEvent() {
  const zone = document.getElementById('zone-labels-event');
  if (zone) zone.innerHTML = renderLabelsEvent(state.event);
}

async function ajouterLabel(nom) {
  nom = nom.trim();
  if (!nom || (state.event.labels || []).includes(nom)) return;
  state.event.labels = [...(state.event.labels || []), nom];
  if (!state.labelsConnus.includes(nom)) state.labelsConnus = [...state.labelsConnus, nom].sort((a, b) => a.localeCompare(b));
  await patch(`/api/events/${state.event.id}`, { labels: state.event.labels });
  redessinerLabelsEvent();
}

async function retirerLabel(nom) {
  state.event.labels = (state.event.labels || []).filter(l => l !== nom);
  await patch(`/api/events/${state.event.id}`, { labels: state.event.labels });
  redessinerLabelsEvent();
}

function afficherSuggestionsLabel() {
  const champ = document.getElementById('champ-nouveau-label');
  const suggestions = document.getElementById('suggestions-label');
  if (!champ || !suggestions) return;
  const saisie = champ.value.trim();
  const q = saisie.toLowerCase();
  const deja = new Set(state.event.labels || []);
  const correspond = (state.labelsConnus || []).filter(l => !deja.has(l) && (!q || l.toLowerCase().includes(q)));
  let html = correspond.map(l => `<button type="button" data-action="label-ajouter" data-label="${esc(l)}">${esc(l)}</button>`).join('');
  if (saisie && !state.labelsConnus.some(l => l.toLowerCase() === q) && !deja.has(saisie)) {
    html += `<button type="button" class="creer" data-action="label-ajouter" data-label="${esc(saisie)}">Créer « ${esc(saisie)} »</button>`;
  }
  suggestions.innerHTML = html || '<p>Tous les labels sont déjà posés</p>';
  suggestions.classList.add('ouvert');
}

function renderChampsMasques(evenement) {
  return [...CHAMPS_EVENT, CHAMP_DESCRIPTION, CHAMP_BUDGET]
    .filter(c => evenement.champsCaches.has(c.champ))
    .map(({ champ, label, glyph, hint }) => `
      <button class="ajout-bloc" data-action="event-champ-ajouter" data-champ="${champ}">
        <span>${glyph}</span>
        <span style="font-size:14px">${label}<small>${hint}</small></span>
      </button>`).join('');
}

function redessinerChampsEvent() {
  document.getElementById('champs-event').innerHTML = renderChampsEvent(state.event);
  document.getElementById('description-event').innerHTML = renderDescriptionEvent(state.event);
  const zone = document.getElementById('champs-masques');
  if (zone) zone.innerHTML = renderChampsMasques(state.event);
}

// toutes les photos d'un événement : la couverture, et chaque champ image renseigné dans ses blocs
function imagesDeEvenement(evenement) {
  const images = [];
  if (evenement.image_url) images.push(evenement.image_url);
  for (const bloc of evenement.blocks) {
    for (const champ of (BLOCK_TYPES[bloc.type]?.fields || [])) {
      if (champ.type === 'image' && bloc.data?.[champ.key]) images.push(bloc.data[champ.key]);
      if (champ.type === 'images') images.push(...imagesDuChampMulti(bloc, champ));
    }
  }
  return images;
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

function ouvrirGalerie(images) {
  let index = 0;
  let zoom = 1;
  dialogue.classList.add('galerie');
  dialogueForm.innerHTML = `
    <h2>Photos</h2>
    <div class="galerie-grille" data-vue="grille">
      ${images.map((url, i) => `
        <button type="button" class="galerie-vignette" data-index="${i}"><img src="${esc(url)}" alt=""></button>`).join('')}
    </div>
    <div class="galerie-agrandi" data-vue="agrandi" hidden>
      <div class="galerie-outils">
        <button type="button" class="icone" data-role="grille">← Toutes les photos</button>
        <span class="spacer"></span>
        <button type="button" class="icone" data-role="zoom-moins" title="Réduire">−</button>
        <button type="button" class="icone" data-role="zoom-plus" title="Agrandir">+</button>
        ${images.length > 1 ? `
          <button type="button" class="icone" data-role="precedent" title="Photo précédente">‹</button>
          <button type="button" class="icone" data-role="suivant" title="Photo suivante">›</button>` : ''}
      </div>
      <div class="galerie-image-zone">
        <img class="galerie-image" alt="">
      </div>
    </div>
    <div class="dialogue-actions">
      <button class="btn-plat" value="fermer">Fermer</button>
    </div>`;

  const vueGrille = dialogueForm.querySelector('[data-vue="grille"]');
  const vueAgrandi = dialogueForm.querySelector('[data-vue="agrandi"]');
  const imgAgrandi = dialogueForm.querySelector('.galerie-image');

  function appliquerZoom() { imgAgrandi.style.transform = `scale(${zoom})`; }

  function afficherAgrandi() {
    zoom = 1;
    imgAgrandi.src = images[index];
    appliquerZoom();
    vueGrille.hidden = true;
    vueAgrandi.hidden = false;
  }

  dialogueForm.querySelectorAll('.galerie-vignette').forEach(bouton => {
    bouton.addEventListener('click', () => { index = Number(bouton.dataset.index); afficherAgrandi(); });
  });
  dialogueForm.querySelector('[data-role="grille"]').addEventListener('click', () => {
    vueAgrandi.hidden = true;
    vueGrille.hidden = false;
  });
  function allerPrecedent() {
    index = (index - 1 + images.length) % images.length;
    afficherAgrandi();
  }
  function allerSuivant() {
    index = (index + 1) % images.length;
    afficherAgrandi();
  }
  dialogueForm.querySelector('[data-role="precedent"]')?.addEventListener('click', allerPrecedent);
  dialogueForm.querySelector('[data-role="suivant"]')?.addEventListener('click', allerSuivant);

  if (images.length > 1) {
    const zoneImage = dialogueForm.querySelector('.galerie-image-zone');
    let depart = null;
    zoneImage.addEventListener('touchstart', e => { depart = e.touches[0].clientX; }, { passive: true });
    zoneImage.addEventListener('touchend', e => {
      if (depart === null) return;
      const delta = e.changedTouches[0].clientX - depart;
      depart = null;
      if (Math.abs(delta) < 40) return;
      delta > 0 ? allerPrecedent() : allerSuivant();
    });
  }
  dialogueForm.querySelector('[data-role="zoom-plus"]').addEventListener('click', () => {
    zoom = Math.min(ZOOM_MAX, zoom + 0.25);
    appliquerZoom();
  });
  dialogueForm.querySelector('[data-role="zoom-moins"]').addEventListener('click', () => {
    zoom = Math.max(ZOOM_MIN, zoom - 0.25);
    appliquerZoom();
  });

  if (images.length === 1) afficherAgrandi();

  dialogue.addEventListener('close', () => dialogue.classList.remove('galerie'), { once: true });
  dialogue.showModal();
}

async function viewEvent(id) {
  const [evenement, labelsConnus] = await Promise.all([
    get(`/api/events/${id}`),
    get('/api/labels').catch(() => [])
  ]);
  evenement.champsCaches = new Set(evenement.hidden_fields || []);
  state.event = evenement;
  state.labelsConnus = labelsConnus;
  await normaliserImagesEvenement(evenement);
  const images = imagesDeEvenement(evenement);
  renderTabs(evenement.theme?.tab_id);
  vue.innerHTML = `
    <p class="fil"><a href="#/theme/${evenement.theme_id}">← ${esc(evenement.theme?.name || 'Retour')}</a></p>
    <div class="event${estAdmin() ? '' : ' seule-colonne'}">
      <section>
        <div class="couverture">
          ${evenement.image_url ? `<img src="${esc(evenement.image_url)}" alt=""${evenement.image_focus ? ` style="object-position:${esc(evenement.image_focus)}"` : ''}>` : ''}
          ${estAdmin() ? `<div class="actions">
            <button class="btn-plat" data-action="event-image">${evenement.image_url ? 'Changer la photo' : 'Ajouter une photo'}</button>
            ${evenement.image_url ? '<button class="btn-plat" data-action="event-image-recadrer">🎯 Recadrer</button>' : ''}
            ${evenement.image_url ? '<button class="btn-plat danger" data-action="event-image-retirer">Retirer</button>' : ''}
          </div>` : ''}
        </div>
        ${images.length ? `<button type="button" class="btn-plat" data-action="event-galerie" data-lecture-ok style="margin-bottom:16px">
          🖼️ Voir les photos (${images.length})</button>` : ''}

        <div class="bloc-papier">
          <input class="titre-event" type="text" data-save="event" data-field="name"
                 value="${esc(evenement.name)}" placeholder="Nom de l’événement">
          <div id="zone-labels-event">${renderLabelsEvent(evenement)}</div>
          <div class="champs" id="champs-event">${renderChampsEvent(evenement)}</div>
          <div id="description-event">${renderDescriptionEvent(evenement)}</div>
          ${estAdmin() ? `<div class="entete-actions" style="margin-top:12px">
            <button class="btn-plat danger" data-action="event-supprimer" data-id="${evenement.id}">Supprimer l’événement</button>
          </div>` : ''}
        </div>

        ${evenement.champsCaches.has('budget') ? '' : `
        <div class="bloc-papier">
          <div class="budget-tete">
            <h2>Budget</h2>
            <label for="c-budget" style="margin:0">Prévu</label>
            <input id="c-budget" type="number" min="0" step="0.01" data-save="event" data-field="budget"
                   value="${esc(evenement.budget ?? '')}">
            <button type="button" class="icone" data-action="event-champ-retirer" data-champ="budget" title="Retirer le budget">✕</button>
          </div>
          <div id="jauge"></div>
          <div id="depenses">${evenement.expenses.map(renderExpense).join('')}</div>
          ${estAdmin() ? `<div class="entete-actions" style="margin-top:12px">
            <button class="btn-plat" data-action="depense-ajouter">+ Ligne de dépense</button>
          </div>` : ''}
          <div class="resume" id="resume"></div>
        </div>`}

        <div class="blocs" id="blocs">${evenement.blocks.map(renderBlock).join('')}</div>
      </section>

      ${estAdmin() ? `<aside class="panneau">
        <h2>Ajouter du contenu</h2>
        <p class="sous">Cliquez pour insérer un élément dans cet événement.</p>
        <div id="champs-masques">${renderChampsMasques(evenement)}</div>
        ${Object.entries(BLOCK_TYPES).map(([type, def]) => `
          <button class="ajout-bloc" data-action="bloc-ajouter" data-type="${esc(type)}">
            <span>${def.glyph}</span>
            <span style="font-size:14px">${esc(def.label)}<small>${esc(def.hint)}</small></span>
          </button>`).join('')}
      </aside>` : ''}
    </div>`;
  majBudget();
  appliquerModeLecture();
  chargerApercusRenvoi();
}

/* -------------------------------------------------------------- dépenses */

function renderExpense(depense) {
  return `
    <div class="depense${depense.paid ? ' payee' : ''}" data-id="${depense.id}">
      <input type="checkbox" data-save="expense" data-field="paid" data-id="${depense.id}"
             ${depense.paid ? 'checked' : ''} aria-label="Payé">
      <input type="text" data-save="expense" data-field="label" data-id="${depense.id}"
             value="${esc(depense.label)}" placeholder="Intitulé">
      <input type="number" step="0.01" data-save="expense" data-field="amount" data-id="${depense.id}"
             value="${esc(depense.amount ?? '')}" placeholder="0">
      <button class="icone danger" data-action="depense-supprimer" data-id="${depense.id}" title="Supprimer">✕</button>
    </div>`;
}

function majBudget() {
  if (!state.event) return;
  const budget = Number(state.event.budget || 0);
  const total = state.event.expenses.reduce((somme, d) => somme + Number(d.amount || 0), 0);
  const paye = state.event.expenses.filter(d => d.paid).reduce((somme, d) => somme + Number(d.amount || 0), 0);
  const reste = budget - total;
  const part = budget ? Math.min(100, (total / budget) * 100) : 0;

  const jauge = document.getElementById('jauge');
  if (jauge) {
    jauge.innerHTML = budget
      ? `<div class="jauge${total > budget ? ' depasse' : ''}"><span style="width:${part}%"></span></div>`
      : '';
  }
  const resume = document.getElementById('resume');
  if (resume) {
    resume.innerHTML = `
      <div>Dépenses : <b>${argent(total)}</b></div>
      <div>Déjà payé : <b>${argent(paye)}</b></div>
      ${budget ? `<div class="${reste < 0 ? 'depasse' : ''}">
        ${reste < 0 ? 'Dépassement' : 'Reste à dépenser'} : <b>${argent(Math.abs(reste))}</b></div>` : ''}`;
  }
}

/* ----------------------------------------------------------------- blocs */

function renderBlock(bloc) {
  const def = BLOCK_TYPES[bloc.type] || { label: bloc.type, glyph: '•', fields: [] };
  const extras = Array.isArray(bloc.data?.__extras) ? bloc.data.__extras : [];
  return `
    <article class="block" data-type="${esc(bloc.type)}" data-id="${bloc.id}">
      <header>
        <span class="glyph">${def.glyph}</span>
        <input class="block-titre" type="text" data-save="block" data-field="title" data-id="${bloc.id}"
               value="${esc(bloc.title || '')}" placeholder="${esc(def.label)}">
        <button class="icone" data-action="extra-ajouter" data-id="${bloc.id}">+ Champ</button>
        <button class="icone danger" data-action="bloc-supprimer" data-id="${bloc.id}" title="Supprimer">✕</button>
      </header>
      ${def.fields.map(champ => renderBlockField(bloc, champ)).join('')}
      ${extras.map((extra, index) => `
        <div class="champ">
          <label>
            <input type="text" data-save="extra" data-part="label" data-index="${index}" data-id="${bloc.id}"
                   value="${esc(extra.label || '')}" placeholder="Nom du champ" style="border:0;padding:0;font:inherit">
          </label>
          <input type="text" data-save="extra" data-part="value" data-index="${index}" data-id="${bloc.id}"
                 value="${esc(extra.value || '')}">
          <button class="icone danger" data-action="extra-supprimer" data-index="${index}" data-id="${bloc.id}">Retirer ce champ</button>
        </div>`).join('')}
    </article>`;
}

function imagesDuChampMulti(bloc, champ) {
  const valeur = bloc.data?.[champ.key];
  if (Array.isArray(valeur)) return valeur;
  if (bloc.data?.image) return [bloc.data.image]; // migration depuis l’ancien champ « image » unique
  return [];
}

// corrige les blocs « images » dont le tableau contient une entrée vide (ex. un
// envoi de fichier interrompu par une coupure réseau) et termine la migration
// des blocs encore sur l’ancien champ « image » unique — une fois pour toutes.
async function normaliserImagesEvenement(evenement) {
  for (const bloc of evenement.blocks) {
    for (const champ of (BLOCK_TYPES[bloc.type]?.fields || [])) {
      if (champ.type !== 'images') continue;
      const brut = imagesDuChampMulti(bloc, champ);
      const nettoye = brut.filter(Boolean);
      const propre = Array.isArray(bloc.data[champ.key]) && nettoye.length === brut.length && !('image' in bloc.data);
      if (propre) continue;
      bloc.data[champ.key] = nettoye;
      delete bloc.data.image;
      if (estAdmin()) await patch(`/api/blocks/${bloc.id}`, { data: bloc.data }).catch(() => {});
    }
  }
}

function renderBlockField(bloc, champ) {
  const valeur = bloc.data?.[champ.key];
  const ref = `data-id="${bloc.id}" data-key="${esc(champ.key)}"`;
  switch (champ.type) {
    case 'textarea':
      return `<div class="champ"><label>${esc(champ.label)}</label>
        <textarea data-save="block-data" ${ref}>${esc(valeur || '')}</textarea></div>`;

    case 'list':
      return `<div class="champ"><label>${esc(champ.label)}</label>
        <textarea data-save="block-data" data-liste="1" ${ref}>${esc((Array.isArray(valeur) ? valeur : []).join('\n'))}</textarea></div>`;

    case 'image':
      return `<div class="champ"><label>${esc(champ.label)}</label>
        ${valeur ? `<div class="apercu"><img src="${esc(valeur)}" alt=""></div>` : ''}
        <button class="btn-plat" data-action="bloc-image" ${ref}>${valeur ? 'Changer l’image' : 'Choisir une image'}</button>
        ${valeur ? `<button class="icone danger" data-action="bloc-vider" ${ref}>Retirer</button>` : ''}</div>`;

    case 'images': {
      const images = imagesDuChampMulti(bloc, champ);
      return `<div class="champ"><label>${esc(champ.label)}</label>
        ${images.length ? `<div class="apercu-multi">
          ${images.map((url, i) => `
            <div class="apercu-multi-item">
              <img src="${esc(url)}" alt="">
              <button class="icone danger" data-action="bloc-image-retirer" ${ref} data-index="${i}" title="Retirer">✕</button>
            </div>`).join('')}
        </div>` : ''}
        <button class="btn-plat" data-action="bloc-images-ajouter" ${ref}>+ Ajouter des images</button></div>`;
    }

    case 'renvoi':
      return valeur
        ? `<div class="champ renvoi-carte" data-renvoi-vers="${esc(valeur)}"><p class="renvoi-chargement">Chargement…</p></div>`
        : `<p class="renvoi-vide">Cliquez sur « Élément lié » pour choisir l’événement à réutiliser.</p>`;

    case 'file':
      return `<div class="champ"><label>${esc(champ.label)}</label>
        ${valeur?.url ? `<div class="fichier">
          <a href="${esc(valeur.url)}" download="${esc(valeur.name || '')}">${esc(valeur.name || 'Fichier')}</a>
          <button class="icone danger" data-action="bloc-vider" ${ref}>Retirer</button></div>` : ''}
        <button class="btn-plat" data-action="bloc-fichier" ${ref}>${valeur?.url ? 'Remplacer le fichier' : 'Choisir un fichier'}</button></div>`;

    case 'checklist': {
      const lignes = Array.isArray(valeur) ? valeur : [];
      return `<div class="champ"><label>${esc(champ.label)}</label>
        ${lignes.map((ligne, index) => `
          <div class="ligne-check${ligne.done ? ' faite' : ''}">
            <input type="checkbox" data-save="check" data-part="done" data-index="${index}" ${ref} ${ligne.done ? 'checked' : ''} aria-label="Fait">
            <input type="text" data-save="check" data-part="text" data-index="${index}" ${ref} value="${esc(ligne.text || '')}">
            <button class="icone danger" data-action="check-supprimer" data-index="${index}" ${ref} title="Supprimer">✕</button>
          </div>`).join('')}
        <button class="icone" data-action="check-ajouter" ${ref}>+ Ligne</button></div>`;
    }

    default:
      return `<div class="champ"><label>${esc(champ.label)}</label>
        <input type="text" data-save="block-data" ${ref} value="${esc(valeur || '')}"></div>`;
  }
}

function redrawBlock(id) {
  const bloc = state.event.blocks.find(b => String(b.id) === String(id));
  const noeud = document.querySelector(`.block[data-id="${id}"]`);
  if (bloc && noeud) noeud.outerHTML = renderBlock(bloc);
}

const trouverBloc = id => state.event.blocks.find(b => String(b.id) === String(id));

function sauverBloc(id) {
  const bloc = trouverBloc(id);
  if (!bloc) return;
  debounce(`block-${id}`, () => patch(`/api/blocks/${id}`, { data: bloc.data }).catch(signaler));
}

const signaler = erreur => alert(erreur.message || 'Une erreur est survenue.');

/* ------------------------------------------------------------- actions */

document.addEventListener('click', async evenement => {
  const bouton = evenement.target.closest('[data-action]');
  if (!bouton) return;
  if (bouton.tagName !== 'INPUT') evenement.preventDefault();
  const { action, id, key, type, index } = bouton.dataset;
  const bloc = id && state.event ? trouverBloc(id) : null;

  try {
    switch (action) {
      case 'onglet-ajouter': {
        const reponse = await demander('Nouvel onglet', [{ key: 'name', label: 'Nom de l’onglet' }]);
        if (!reponse?.name) return;
        const onglet = await post('/api/tabs', { name: reponse.name });
        await rechargerOnglets();
        location.hash = `#/tab/${onglet.id}`;
        break;
      }
      case 'onglet-modifier': {
        const onglet = state.tabs.find(t => String(t.id) === String(id));
        const reponse = await demander('Modifier l’onglet', [{ key: 'name', label: 'Nom', value: onglet?.name }]);
        if (!reponse?.name) return;
        await patch(`/api/tabs/${id}`, { name: reponse.name });
        await rechargerOnglets();
        route();
        break;
      }
      case 'onglet-supprimer': {
        if (!confirm('Supprimer cet onglet, ses thèmes et tous leurs événements ?')) return;
        await supprimer(`/api/tabs/${id}`);
        await rechargerOnglets();
        location.hash = state.tabs[0] ? `#/tab/${state.tabs[0].id}` : '#/';
        route();
        break;
      }
      case 'theme-ajouter': {
        const reponse = await demander('Nouveau thème', [
          { key: 'name', label: 'Nom du thème' },
          { key: 'description', label: 'Description (facultative)' }
        ]);
        if (!reponse?.name) return;
        const theme = await post('/api/themes', { tab_id: Number(id), ...reponse });
        location.hash = `#/theme/${theme.id}`;
        break;
      }
      case 'theme-image': {
        const fichier = await choisirFichier('image/*');
        if (!fichier) return;
        await patch(`/api/themes/${id}`, { image_url: fichier.url, image_focus: '' });
        route();
        break;
      }
      case 'theme-image-retirer': {
        await patch(`/api/themes/${id}`, { image_url: '', image_focus: '' });
        route();
        break;
      }
      case 'theme-image-recadrer': {
        const theme = await get(`/api/themes/${id}`);
        const focus = await ouvrirRecadrage({
          imageUrl: theme.image_url, focus: theme.image_focus, ratioApercu: '2 / 1', largeurApercu: 200
        });
        if (!focus) return;
        await patch(`/api/themes/${id}`, { image_focus: focus });
        route();
        break;
      }
      case 'theme-modifier': {
        const theme = await get(`/api/themes/${id}`);
        const reponse = await demander('Modifier le thème', [
          { key: 'name', label: 'Nom', value: theme.name },
          { key: 'description', label: 'Description', value: theme.description }
        ]);
        if (!reponse?.name) return;
        await patch(`/api/themes/${id}`, reponse);
        route();
        break;
      }
      case 'theme-supprimer': {
        if (!confirm('Supprimer ce thème et tous ses événements ?')) return;
        const theme = await get(`/api/themes/${id}`);
        await supprimer(`/api/themes/${id}`);
        location.hash = `#/tab/${theme.tab_id}`;
        break;
      }
      case 'event-ajouter': {
        const reponse = await demander('Nouvel événement', [
          { key: 'name', label: 'Nom de l’événement' },
          { key: 'event_date', label: 'Date', type: 'date' },
          { key: 'location', label: 'Lieu' }
        ]);
        if (!reponse?.name) return;
        const nouvel = await post('/api/events', { theme_id: Number(id), ...reponse });
        location.hash = `#/event/${nouvel.id}`;
        break;
      }
      case 'event-supprimer': {
        if (!confirm('Supprimer cet événement, son budget et son contenu ?')) return;
        const theme = state.event.theme_id;
        await supprimer(`/api/events/${id}`);
        location.hash = `#/theme/${theme}`;
        break;
      }
      case 'event-image': {
        const fichier = await choisirFichier('image/*');
        if (!fichier) return;
        await patch(`/api/events/${state.event.id}`, { image_url: fichier.url, image_focus: '' });
        route();
        break;
      }
      case 'event-image-retirer': {
        await patch(`/api/events/${state.event.id}`, { image_url: '', image_focus: '' });
        route();
        break;
      }
      case 'event-image-recadrer': {
        const focus = await ouvrirRecadrage({
          imageUrl: state.event.image_url, focus: state.event.image_focus, ratioApercu: '3 / 1', largeurApercu: 210
        });
        if (!focus) return;
        await patch(`/api/events/${state.event.id}`, { image_focus: focus });
        route();
        break;
      }
      case 'event-galerie': {
        ouvrirGalerie(imagesDeEvenement(state.event));
        break;
      }
      case 'event-champ-retirer': {
        const champ = bouton.dataset.champ;
        state.event.champsCaches.add(champ);
        if (champ !== 'budget') state.event[champ] = champ === 'guests' ? null : '';
        await patch(`/api/events/${state.event.id}`, {
          ...(champ === 'budget' ? {} : { [champ]: '' }),
          hidden_fields: [...state.event.champsCaches]
        });
        if (champ === 'budget') { route(); break; }
        redessinerChampsEvent();
        break;
      }
      case 'event-champ-ajouter': {
        const champ = bouton.dataset.champ;
        state.event.champsCaches.delete(champ);
        await patch(`/api/events/${state.event.id}`, { hidden_fields: [...state.event.champsCaches] });
        if (champ === 'budget') { route(); break; }
        redessinerChampsEvent();
        document.getElementById(champ === 'description' ? 'c-desc' : `c-${champ}`)?.focus();
        break;
      }
      case 'label-retirer': {
        await retirerLabel(bouton.dataset.label);
        break;
      }
      case 'label-ajouter': {
        await ajouterLabel(bouton.dataset.label);
        const champ = document.getElementById('champ-nouveau-label');
        if (champ) { champ.value = ''; champ.focus(); }
        document.getElementById('suggestions-label')?.classList.remove('ouvert');
        break;
      }
      case 'depense-ajouter': {
        const depense = await post(`/api/events/${state.event.id}/expenses`, { label: '', amount: 0 });
        state.event.expenses.push(depense);
        document.getElementById('depenses').insertAdjacentHTML('beforeend', renderExpense(depense));
        document.querySelector(`.depense[data-id="${depense.id}"] input[type=text]`).focus();
        majBudget();
        break;
      }
      case 'depense-supprimer': {
        await supprimer(`/api/expenses/${id}`);
        state.event.expenses = state.event.expenses.filter(d => String(d.id) !== String(id));
        document.querySelector(`.depense[data-id="${id}"]`).remove();
        majBudget();
        break;
      }
      case 'bloc-ajouter': {
        let data = {};
        if (type === 'renvoi') {
          const choisi = await choisirEvenementLie();
          if (!choisi) return;
          data = { event_id: choisi.id };
        }
        const nouveau = await post(`/api/events/${state.event.id}/blocks`, { type, data });
        state.event.blocks.push(nouveau);
        document.getElementById('blocs').insertAdjacentHTML('beforeend', renderBlock(nouveau));
        document.querySelector(`.block[data-id="${nouveau.id}"]`).scrollIntoView({ block: 'center' });
        if (type === 'renvoi') chargerApercusRenvoi();
        break;
      }
      case 'bloc-supprimer': {
        if (!confirm('Supprimer cet élément ?')) return;
        await supprimer(`/api/blocks/${id}`);
        state.event.blocks = state.event.blocks.filter(b => String(b.id) !== String(id));
        document.querySelector(`.block[data-id="${id}"]`).remove();
        break;
      }
      case 'bloc-image': {
        const fichier = await choisirFichier('image/*');
        if (!fichier) return;
        bloc.data[key] = fichier.url;
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'bloc-images-ajouter': {
        const fichiers = await choisirFichiers('image/*');
        if (!fichiers.length) return;
        if (!Array.isArray(bloc.data[key])) {
          bloc.data[key] = bloc.data.image ? [bloc.data.image] : [];
          delete bloc.data.image;
        }
        for (const fichier of fichiers) {
          const televerse = await envoyerFichier(fichier, fichier.name);
          if (televerse?.url) bloc.data[key].push(televerse.url);
        }
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'bloc-image-retirer': {
        if (!Array.isArray(bloc.data[key])) {
          bloc.data[key] = bloc.data.image ? [bloc.data.image] : [];
          delete bloc.data.image;
        }
        bloc.data[key].splice(Number(index), 1);
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'bloc-fichier': {
        const fichier = await choisirFichier();
        if (!fichier) return;
        bloc.data[key] = { url: fichier.url, name: fichier.name };
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'bloc-vider': {
        delete bloc.data[key];
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'check-ajouter': {
        if (!Array.isArray(bloc.data[key])) bloc.data[key] = [];
        bloc.data[key].push({ text: '', done: false });
        sauverBloc(id);
        redrawBlock(id);
        document.querySelector(`.block[data-id="${id}"] .ligne-check:last-of-type input[type=text]`)?.focus();
        break;
      }
      case 'check-supprimer': {
        bloc.data[key].splice(Number(index), 1);
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'extra-ajouter': {
        const reponse = await demander('Ajouter un champ', [{ key: 'label', label: 'Nom du champ' }]);
        if (!reponse?.label) return;
        if (!Array.isArray(bloc.data.__extras)) bloc.data.__extras = [];
        bloc.data.__extras.push({ label: reponse.label, value: '' });
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'extra-supprimer': {
        bloc.data.__extras.splice(Number(index), 1);
        sauverBloc(id);
        redrawBlock(id);
        break;
      }
      case 'voir-comptes': {
        location.hash = '#/comptes';
        break;
      }
      case 'compte-mdp-aleatoire': {
        const champ = document.getElementById('nc-mdp');
        champ.type = 'text';
        champ.value = motDePasseAleatoire();
        break;
      }
      case 'deconnexion': {
        await post('/api/logout').catch(() => {});
        state.user = null;
        renderCompte();
        afficherConnexion();
        break;
      }
      case 'compte-permissions': {
        const zone = document.querySelector(`.permissions-arbre[data-permissions="${id}"]`);
        if (!zone.hidden) { zone.hidden = true; break; }
        const [permises, arborescence] = await Promise.all([
          get(`/api/users/${id}/permissions`),
          chargerArborescence()
        ]);
        zone.innerHTML = arborescence.length
          ? arborescence.map(({ tab, theme }) => `
              <details class="permissions-theme">
                <summary>${esc(tab.name)} → ${esc(theme.name)}</summary>
                ${theme.events.length
                  ? theme.events.map(ev => `
                      <label class="permissions-evenement">
                        <input type="checkbox" data-action="compte-permission-toggle"
                               data-compte="${id}" data-event="${ev.id}" ${permises.includes(ev.id) ? 'checked' : ''}>
                        ${esc(ev.name)}
                      </label>`).join('')
                  : '<p class="sous" style="padding-left:20px">Aucun événement</p>'}
              </details>`).join('')
          : '<p class="sous">Aucun thème pour l’instant.</p>';
        zone.hidden = false;
        break;
      }
      case 'compte-permission-toggle': {
        const url = `/api/users/${bouton.dataset.compte}/permissions/${bouton.dataset.event}`;
        await (bouton.checked ? post(url) : supprimer(url));
        break;
      }
      case 'compte-basculer': {
        await patch(`/api/users/${id}`, { active: bouton.dataset.actif !== 'true' });
        await viewComptes();
        break;
      }
      case 'compte-supprimer': {
        if (!confirm('Supprimer définitivement ce compte ?')) return;
        await supprimer(`/api/users/${id}`);
        await viewComptes();
        break;
      }
    }
  } catch (erreur) {
    signaler(erreur);
  }
});

/* --------------------------------------------------- sauvegarde continue */

document.addEventListener('input', evenement => {
  const cible = evenement.target;
  const quoi = cible.dataset.save;
  if (!quoi) return;
  const { id, field, key, part, index } = cible.dataset;
  const valeur = cible.type === 'checkbox' ? cible.checked : cible.value;

  if (quoi === 'event') {
    if (field === 'budget') {
      state.event.budget = valeur === '' ? null : Number(valeur);
      majBudget();
    }
    debounce(`event-${field}`, () =>
      patch(`/api/events/${state.event.id}`, { [field]: valeur }).catch(signaler));
    return;
  }

  if (quoi === 'expense') {
    const depense = state.event.expenses.find(d => String(d.id) === String(id));
    depense[field] = field === 'amount' ? Number(valeur || 0) : valeur;
    if (field === 'paid') cible.closest('.depense').classList.toggle('payee', cible.checked);
    if (field !== 'label') majBudget();
    debounce(`expense-${id}-${field}`, () =>
      patch(`/api/expenses/${id}`, { [field]: depense[field] }).catch(signaler));
    return;
  }

  if (quoi === 'block') {
    debounce(`block-titre-${id}`, () =>
      patch(`/api/blocks/${id}`, { [field]: valeur }).catch(signaler));
    return;
  }

  const bloc = trouverBloc(id);
  if (!bloc) return;

  if (quoi === 'block-data') {
    bloc.data[key] = cible.dataset.liste
      ? valeur.split('\n').map(l => l.trim()).filter(Boolean)
      : valeur;
  } else if (quoi === 'check') {
    const ligne = bloc.data[key][Number(index)];
    ligne[part === 'done' ? 'done' : 'text'] = valeur;
    if (part === 'done') cible.closest('.ligne-check').classList.toggle('faite', cible.checked);
  } else if (quoi === 'extra') {
    bloc.data.__extras[Number(index)][part] = valeur;
  } else {
    return;
  }
  sauverBloc(id);
});

/* ------------------------------------------------------------ recherche */

const champRecherche = document.getElementById('recherche');
const resultats = document.getElementById('resultats');

champRecherche.addEventListener('input', () => {
  const q = champRecherche.value.trim();
  if (q.length < 3) {
    resultats.hidden = true;
    return;
  }
  debounce('recherche', async () => {
    const trouves = await get(`/api/search?q=${encodeURIComponent(q)}`).catch(() => []);
    resultats.hidden = false;
    resultats.innerHTML = trouves.length
      ? trouves.map(e => `<a href="#/event/${e.id}">${esc(e.name)}
          <small>${esc([e.theme_name, dateFr(e.event_date)].filter(Boolean).join(' · '))}</small></a>`).join('')
      : '<p>Aucun événement trouvé.</p>';
  }, 300);
});

document.addEventListener('click', evenement => {
  if (!evenement.target.closest('.recherche')) resultats.hidden = true;
});

resultats.addEventListener('click', () => {
  champRecherche.value = '';
  resultats.hidden = true;
});

/* -------------------------------------------------------- filtre labels */

const boutonFiltreLabels = document.getElementById('bouton-filtre-labels');
const panneauFiltreLabels = document.getElementById('panneau-filtre-labels');
const compteFiltreLabels = document.getElementById('compte-filtre-labels');
const zoneFiltreLabels = document.getElementById('filtre-labels');
const zoneFiltreResultats = document.getElementById('filtre-resultats');
const labelsActifs = new Set();
let labelsFiltreCharges = false;

async function actualiserFiltreLabels() {
  compteFiltreLabels.hidden = labelsActifs.size === 0;
  compteFiltreLabels.textContent = labelsActifs.size;
  boutonFiltreLabels.classList.toggle('actif', labelsActifs.size > 0);
  if (!labelsActifs.size) {
    zoneFiltreResultats.innerHTML = '<p class="filtre-vide">Choisissez un ou plusieurs labels ci-dessus.</p>';
    return;
  }
  const trouves = await get(`/api/search?labels=${encodeURIComponent([...labelsActifs].join(','))}`).catch(() => []);
  if (!trouves.length) {
    zoneFiltreResultats.innerHTML = '<p class="filtre-vide">Aucun événement avec tous ces labels.</p>';
    return;
  }
  const parTheme = {};
  for (const e of trouves) (parTheme[e.theme_name] ??= []).push(e);
  zoneFiltreResultats.innerHTML = Object.entries(parTheme).map(([theme, evs]) => `
    <div class="theme-nom">${esc(theme)}</div>
    ${evs.map(e => `<a class="evenement" href="#/event/${e.id}">${esc(e.name)}</a>`).join('')}`).join('');
}

boutonFiltreLabels.addEventListener('click', async () => {
  panneauFiltreLabels.hidden = !panneauFiltreLabels.hidden;
  if (panneauFiltreLabels.hidden) return;
  if (!labelsFiltreCharges) {
    const tous = await get('/api/labels').catch(() => []);
    zoneFiltreLabels.innerHTML = tous.length
      ? tous.map(l => `<button type="button" class="filtre-chip" data-label="${esc(l)}">${esc(l)}</button>`).join('')
      : '<p class="filtre-vide">Aucun label pour l’instant.</p>';
    zoneFiltreLabels.querySelectorAll('.filtre-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const l = chip.dataset.label;
        labelsActifs.has(l) ? labelsActifs.delete(l) : labelsActifs.add(l);
        chip.classList.toggle('actif');
        actualiserFiltreLabels();
      });
    });
    labelsFiltreCharges = true;
  }
  actualiserFiltreLabels();
});

document.addEventListener('click', evenement => {
  if (!evenement.target.closest('.filtre-labels-conteneur')) panneauFiltreLabels.hidden = true;
});

zoneFiltreResultats.addEventListener('click', evenement => {
  if (evenement.target.closest('a')) panneauFiltreLabels.hidden = true;
});

/* --------------------------------------------------- labels d'un événement */

document.addEventListener('focusin', evenement => {
  if (evenement.target.id === 'champ-nouveau-label') afficherSuggestionsLabel();
});
document.addEventListener('input', evenement => {
  if (evenement.target.id === 'champ-nouveau-label') afficherSuggestionsLabel();
});
document.addEventListener('keydown', evenement => {
  if (evenement.target.id !== 'champ-nouveau-label' || evenement.key !== 'Enter') return;
  const saisie = evenement.target.value.trim();
  if (!saisie) return;
  evenement.preventDefault();
  ajouterLabel(saisie);
  evenement.target.value = '';
  document.getElementById('suggestions-label')?.classList.remove('ouvert');
});
document.addEventListener('click', evenement => {
  if (!evenement.target.closest('.label-ajout')) document.getElementById('suggestions-label')?.classList.remove('ouvert');
});

/* ------------------------------------------------------------ formulaires d'accès */

formConnexion.addEventListener('submit', async evenement => {
  evenement.preventDefault();
  erreurConnexion.hidden = true;
  try {
    state.user = await connexion(formConnexion.username.value.trim(), formConnexion.password.value);
    formConnexion.reset();
    if (state.user.must_change_password) return afficherEcranMdp();
    await demarrerApplication();
  } catch (erreur) {
    erreurConnexion.textContent = erreur.message;
    erreurConnexion.hidden = false;
  }
});

formMdp.addEventListener('submit', async evenement => {
  evenement.preventDefault();
  erreurMdp.hidden = true;
  if (formMdp.password.value !== formMdp.confirmation.value) {
    erreurMdp.textContent = 'Les deux mots de passe ne correspondent pas.';
    erreurMdp.hidden = false;
    return;
  }
  try {
    await post('/api/password', { password: formMdp.password.value });
    state.user.must_change_password = false;
    formMdp.reset();
    await demarrerApplication();
  } catch (erreur) {
    erreurMdp.textContent = erreur.message;
    erreurMdp.hidden = false;
  }
});

/* ---------------------------------------------------------- démarrage */

async function verifierSession() {
  try {
    const reponse = await fetch('/api/me');
    if (reponse.status === 401) return afficherConnexion();
    state.user = await reponse.json();
    if (state.user.must_change_password) return afficherEcranMdp();
    await demarrerApplication();
  } catch {
    vue.innerHTML = vide('Impossible de contacter le serveur.');
  }
}

window.addEventListener('hashchange', route);
verifierSession();
