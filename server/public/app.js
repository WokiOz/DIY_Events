const BLOCK_TYPES = {
  note: {
    label: 'Note', glyph: '📝', hint: 'Une idée, un rappel',
    fields: [{ key: 'texte', label: 'Note', type: 'textarea' }]
  },
  image: {
    label: 'Image', glyph: '🖼️', hint: 'Photo ou inspiration',
    fields: [
      { key: 'image', label: 'Image', type: 'image' },
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
  document.querySelectorAll('#vue [data-action]').forEach(el => el.remove());
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

function choisirFichier(accept) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.onchange = async () => {
      const fichier = input.files[0];
      if (!fichier) return resolve(null);
      const formulaire = new FormData();
      formulaire.append('file', fichier);
      const reponse = await fetch('/api/upload', { method: 'POST', body: formulaire });
      const donnees = await reponse.json().catch(() => null);
      if (!reponse.ok) {
        alert(donnees?.error || 'L’envoi du fichier a échoué.');
        return resolve(null);
      }
      resolve(donnees);
    };
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
    <div class="visuel">${theme.image_url ? `<img src="${esc(theme.image_url)}" alt="">` : '✦'}</div>
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
        <button class="btn-plat" data-action="theme-modifier" data-id="${theme.id}">Modifier le thème</button>
        <button class="btn-plat danger" data-action="theme-supprimer" data-id="${theme.id}">Supprimer le thème</button>
        <button class="btn" data-action="event-ajouter" data-id="${theme.id}">+ Nouvel événement</button>
      </div>` : ''}
    </div>
    <div class="liste-events">${theme.events.map(ligneEvent).join('')}</div>
    ${theme.events.length ? '' : vide('Aucun événement dans ce thème.')}`;
  appliquerModeLecture();
}

function ligneEvent(evenement) {
  const budget = Number(evenement.budget || 0);
  const depense = Number(evenement.spent || 0);
  const infos = [dateFr(evenement.event_date), evenement.location, evenement.guests ? `${evenement.guests} invités` : '']
    .filter(Boolean).join(' · ');
  return `
    <a class="ligne-event" href="#/event/${evenement.id}">
      <div>
        <h3>${esc(evenement.name)}</h3>
        ${infos ? `<div class="infos">${esc(infos)}</div>` : ''}
      </div>
      ${budget ? `<div class="argent">
        <span class="${depense > budget ? 'depasse' : ''}">${argent(depense)}</span> sur ${argent(budget)}
      </div>` : ''}
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
      <div><label for="nc-mdp">Mot de passe</label><input id="nc-mdp" name="password" type="password" required minlength="4"></div>
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

async function viewEvent(id) {
  const evenement = await get(`/api/events/${id}`);
  state.event = evenement;
  renderTabs(evenement.theme?.tab_id);
  vue.innerHTML = `
    <p class="fil"><a href="#/theme/${evenement.theme_id}">← ${esc(evenement.theme?.name || 'Retour')}</a></p>
    <div class="event${estAdmin() ? '' : ' seule-colonne'}">
      <section>
        <div class="couverture">
          ${evenement.image_url ? `<img src="${esc(evenement.image_url)}" alt="">` : ''}
          ${estAdmin() ? `<div class="actions">
            <button class="btn-plat" data-action="event-image">${evenement.image_url ? 'Changer la photo' : 'Ajouter une photo'}</button>
            ${evenement.image_url ? '<button class="btn-plat danger" data-action="event-image-retirer">Retirer</button>' : ''}
          </div>` : ''}
        </div>

        <div class="bloc-papier">
          <input class="titre-event" type="text" data-save="event" data-field="name"
                 value="${esc(evenement.name)}" placeholder="Nom de l’événement">
          <div class="champs">
            <div><label for="c-date">Date</label>
              <input id="c-date" type="date" data-save="event" data-field="event_date"
                     value="${esc((evenement.event_date || '').slice(0, 10))}"></div>
            <div><label for="c-lieu">Lieu</label>
              <input id="c-lieu" type="text" data-save="event" data-field="location"
                     value="${esc(evenement.location || '')}"></div>
            <div><label for="c-invites">Invités</label>
              <input id="c-invites" type="number" min="0" data-save="event" data-field="guests"
                     value="${esc(evenement.guests ?? '')}"></div>
          </div>
          <label for="c-desc">Description</label>
          <textarea id="c-desc" data-save="event" data-field="description">${esc(evenement.description || '')}</textarea>
          ${estAdmin() ? `<div class="entete-actions" style="margin-top:12px">
            <button class="btn-plat danger" data-action="event-supprimer" data-id="${evenement.id}">Supprimer l’événement</button>
          </div>` : ''}
        </div>

        <div class="bloc-papier">
          <div class="budget-tete">
            <h2>Budget</h2>
            <label for="c-budget" style="margin:0">Prévu</label>
            <input id="c-budget" type="number" min="0" step="0.01" data-save="event" data-field="budget"
                   value="${esc(evenement.budget ?? '')}">
          </div>
          <div id="jauge"></div>
          <div id="depenses">${evenement.expenses.map(renderExpense).join('')}</div>
          ${estAdmin() ? `<div class="entete-actions" style="margin-top:12px">
            <button class="btn-plat" data-action="depense-ajouter">+ Ligne de dépense</button>
          </div>` : ''}
          <div class="resume" id="resume"></div>
        </div>

        <div class="blocs" id="blocs">${evenement.blocks.map(renderBlock).join('')}</div>
      </section>

      ${estAdmin() ? `<aside class="panneau">
        <h2>Ajouter du contenu</h2>
        <p class="sous">Cliquez pour insérer un élément dans cet événement.</p>
        ${Object.entries(BLOCK_TYPES).map(([type, def]) => `
          <button class="ajout-bloc" data-action="bloc-ajouter" data-type="${esc(type)}">
            <span>${def.glyph}</span>
            <span style="font-size:14px">${esc(def.label)}<small>${esc(def.hint)}</small></span>
          </button>`).join('')}
      </aside>` : ''}
    </div>`;
  majBudget();
  appliquerModeLecture();
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
        await patch(`/api/events/${state.event.id}`, { image_url: fichier.url });
        route();
        break;
      }
      case 'event-image-retirer': {
        await patch(`/api/events/${state.event.id}`, { image_url: '' });
        route();
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
        const nouveau = await post(`/api/events/${state.event.id}/blocks`, { type, data: {} });
        state.event.blocks.push(nouveau);
        document.getElementById('blocs').insertAdjacentHTML('beforeend', renderBlock(nouveau));
        document.querySelector(`.block[data-id="${nouveau.id}"]`).scrollIntoView({ block: 'center' });
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
