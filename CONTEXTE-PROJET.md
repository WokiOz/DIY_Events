# Mes événements — contexte technique

Document de référence du projet. À joindre aux connaissances du projet.

## 1. Ce que fait l'application

Application web auto-hébergée pour organiser des événements familiaux. Hiérarchie à quatre niveaux :

```
Onglet (« Fêtes de famille », « Voyages »)
└── Thème (« Anniversaires », « Mariages », « Baptêmes »)
    └── Événement (« Anniversaire d'Elyan, 30 ans ») — date, lieu, invités, budget
        ├── Dépenses (lignes cochables, comparées au budget prévu)
        └── Blocs de contenu (note, image, recette, plan de déco, fichier 3D…)
```

Usage familial, sur réseau local. Un seul utilisateur, pas de compte, pas de mot de passe. Tout s'enregistre automatiquement pendant la frappe, il n'y a aucun bouton « sauvegarder ».

## 2. Pile technique

| Élément | Choix | Raison |
|---|---|---|
| Base | PostgreSQL 16 | JSONB pour le contenu libre des blocs |
| Serveur | Node.js 20, Express 4 (ESM) | simple, une seule dépendance par besoin |
| Front | HTML + CSS + JavaScript natif | aucune étape de build, les fichiers sont servis tels quels |
| Fichiers | multer, volume Docker `uploads` | images et pièces jointes |
| Orchestration | Docker Compose, 2 services | `db` et `app` |

Dépendances npm volontairement limitées à `express`, `pg`, `multer`. Aucun framework front, aucun bundler, aucun TypeScript.

## 3. Arborescence

```
mes-evenements/
├── docker-compose.yml        services db + app, volumes db-data et uploads
├── .env.example              APP_PORT, identifiants Postgres
├── README.md                 mode d'emploi utilisateur
└── server/
    ├── Dockerfile            node:20-alpine
    ├── package.json          "type": "module"
    ├── src/
    │   ├── index.js          API REST, upload, service des fichiers statiques
    │   ├── db.js             pool pg, initDatabase() avec attente de la base
    │   └── schema.sql        schéma + données d'exemple, rejoué à chaque démarrage
    └── public/
        ├── index.html        coquille : topbar, rail d'onglets, <main>, <dialog>
        ├── styles.css        tokens CSS et styles
        └── app.js            toute la logique front
```

## 4. Modèle de données

```
tabs      id, name, image_url, position, created_at
themes    id, tab_id→tabs, name, image_url, description, position, created_at
events    id, theme_id→themes, name, description, event_date, location,
          guests, budget, image_url, position, created_at
blocks    id, event_id→events, type, title, data (JSONB), position, created_at
expenses  id, event_id→events, label, amount, paid, position
```

Toutes les clés étrangères sont en `ON DELETE CASCADE` : supprimer un onglet supprime ses thèmes, événements, blocs et dépenses.

`blocks.data` contient le contenu libre en JSON, sa forme dépend de `blocks.type`. La clé réservée `__extras` stocke les champs personnalisés ajoutés par l'utilisateur : `[{ label, value }]`.

`schema.sql` est rejoué à chaque démarrage du conteneur, il doit donc rester idempotent. Les données d'exemple ne s'insèrent que si les tables sont vides (`WHERE NOT EXISTS`).

## 5. API

Toutes les routes renvoient du JSON. Erreur → `{ error: "message en français" }`.

| Méthode | Route | Effet |
|---|---|---|
| GET, POST | `/api/tabs` | lister, créer |
| PATCH, DELETE | `/api/tabs/:id` | modifier, supprimer |
| GET | `/api/tabs/:id/themes` | thèmes + `event_count` |
| POST | `/api/themes` | créer (`tab_id` dans le corps) |
| GET | `/api/themes/:id` | thème + `events[]` avec `spent` calculé |
| PATCH, DELETE | `/api/themes/:id` | modifier, supprimer |
| POST | `/api/events` | créer (`theme_id` dans le corps) |
| GET | `/api/events/:id` | événement + `blocks[]` + `expenses[]` |
| PATCH, DELETE | `/api/events/:id` | modifier, supprimer |
| POST | `/api/events/:id/blocks` | ajouter un bloc |
| PATCH, DELETE | `/api/blocks/:id` | modifier, supprimer |
| POST | `/api/events/:id/expenses` | ajouter une dépense |
| PATCH, DELETE | `/api/expenses/:id` | modifier, supprimer |
| POST | `/api/upload` | `multipart/form-data`, champ `file` → `{ url, name, size }` |
| POST | `/api/reorder` | `{ table, ids: [] }`, tables autorisées : tabs, themes, events, blocks |
| GET | `/api/search?q=` | recherche d'événements, minimum 3 caractères |

Les PATCH sont partiels : seuls les champs présents dans le corps sont modifiés, via la fonction `patch(table, id, body, allowed)` qui n'accepte que les colonnes de la liste blanche. Ajouter une colonne modifiable impose donc de l'ajouter à cette liste.

## 6. Front-end

**Routage** par hash, sans bibliothèque : `#/tab/:id`, `#/theme/:id`, `#/event/:id`. La fonction `route()` choisit la vue, chaque vue réécrit `#view` en entier.

**État** minimal : `state.tabs` et `state.event` (l'événement ouvert, avec ses blocs et dépenses). Le reste est rechargé depuis l'API à chaque navigation.

**Interactions** par délégation d'événements sur `document`, jamais de `onclick` inline :
- clics : `data-action="…"` lu dans un gros `switch`, avec `data-id`, `data-key`, `data-type`, `data-index` ;
- saisie : `data-save="event | expense | block | block-data | check | extra"` avec `data-field` ou `data-key`.

**Sauvegarde automatique** via `debounce(clé, fn, 500)`. Piège important : la clé doit être unique par champ, sinon une sauvegarde annule l'autre. D'où `` `event-${field}` `` et `` `expense-${id}-${field}` ``. Pour les blocs, une seule clé par bloc suffit puisque l'objet `data` complet est renvoyé à chaque fois.

**Rendu** en chaînes de gabarits avec `esc()` sur toute valeur venant de la base. Les fonctions clés : `renderTabs`, `viewTab`, `viewTheme`, `viewEvent`, `renderBlock`, `renderBlockField`, `renderExpense`, `redrawBlock`.

## 7. Système de blocs

Le catalogue `BLOCK_TYPES` en haut de `app.js` décrit chaque type de contenu :

```js
recette: {
  label: 'Recette de cuisine', glyph: '🍰', hint: 'Gâteau, buffet, boissons',
  fields: [
    { key: 'image',       label: 'Photo',                      type: 'image' },
    { key: 'portions',    label: 'Pour combien de personnes',  type: 'text' },
    { key: 'ingredients', label: 'Ingrédients (un par ligne)', type: 'list' },
    { key: 'etapes',      label: 'Préparation',                type: 'textarea' }
  ]
}
```

Types de champs gérés par `renderBlockField` :

| type | stockage dans `data[key]` | rendu |
|---|---|---|
| `text` | chaîne | champ sur une ligne |
| `textarea` | chaîne | zone de texte |
| `list` | tableau de chaînes | zone de texte, une ligne par élément |
| `image` | URL (chaîne) | aperçu + bouton de choix |
| `file` | `{ url, name }` | lien de téléchargement + bouton |
| `checklist` | `[{ text, done }]` | lignes cochables |

Types existants : `note`, `image`, `libre`, `checklist`, `recette`, `deco`, `print3d`, `document`, `prestataire`, `planning`, `lien`. Le panneau de droite de la page événement se construit automatiquement à partir de ce catalogue : ajouter une entrée suffit à faire apparaître le bouton, sans toucher au serveur ni à la base. Une couleur de bordure haute peut être ajoutée dans `styles.css` via `.block[data-type="…"]`.

## 8. Design

Tokens définis dans `:root` :

```
--ink #16211d      texte principal        --pine #1f5a45   couleur d'action
--ink-soft #5d6b65 texte secondaire       --pine-tint #e4efe9
--line #dde4e0     bordures               --gold #a4761f   accents secondaires
--surface #f2f5f3  fond de page           --alert #a03a4e  dépassement, suppression
--paper #ffffff    fond des cartes        --radius 10px    --shell 1180px
```

Typographie : *Bricolage Grotesque* pour les titres, *Public Sans* pour le texte, chargées depuis Google Fonts avec repli sur les polices système.

Principes : interface claire et calme, bordures fines plutôt qu'ombres, une seule couleur d'action, pas de majuscules décoratives, pas d'animation d'apparition. Responsive : sous 900 px le panneau de droite passe sous le contenu. Focus clavier visible, `prefers-reduced-motion` respecté.

## 9. Pièges connus

- `patch()` ne modifie que les colonnes listées dans son quatrième argument. Nouveau champ = ajout dans cette liste.
- Une chaîne vide envoyée en PATCH est convertie en `NULL` (sauf pour `name`). C'est ce qui permet d'effacer une date ou une image.
- `event_date` revient de Postgres au format ISO complet ; le front fait `.slice(0, 10)` pour alimenter un `<input type="date">`.
- Les colonnes `NUMERIC` reviennent en chaîne : les requêtes utilisent `::float` là où le front a besoin d'un nombre.
- `app.get('*')` en fin de `index.js` renvoie `index.html` pour toute route inconnue ; toute nouvelle route API doit être déclarée **avant**.
- Les fichiers envoyés vivent dans le volume `uploads`. Supprimer un bloc ne supprime pas le fichier associé.
- `docker compose down -v` efface la base et les fichiers. Sans `-v`, tout est conservé.

## 10. Commandes utiles

```bash
docker compose up -d --build     # démarrer ou reconstruire après modification du serveur
docker compose logs -f app       # suivre les journaux
docker compose restart app       # redémarrer sans reconstruire
docker compose down              # arrêter en gardant les données
docker compose exec db psql -U evenements evenements    # ouvrir la base
docker compose exec db pg_dump -U evenements evenements > sauvegarde.sql
```

Modifier un fichier de `server/public/` ne demande qu'un rafraîchissement du navigateur si le dossier est monté en volume ; avec l'image telle qu'elle est construite ici, il faut relancer `up -d --build`.

## 11. Pistes d'évolution envisagées

Aucune n'est développée à ce jour :

- page de connexion par mot de passe, indispensable avant toute exposition sur Internet ;
- réordonnancement par glisser-déposer des onglets, thèmes et blocs (la route `/api/reorder` existe déjà, elle n'est pas utilisée par l'interface) ;
- vue calendrier des événements à venir ;
- export d'un événement en PDF ou en page imprimable ;
- duplication d'un événement pour repartir d'un modèle ;
- partage en lecture seule d'un événement par lien ;
- liste d'invités avec suivi des réponses.
