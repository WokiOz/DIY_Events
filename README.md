# Mes événements

Application web conteneurisée pour organiser des événements : onglets horizontaux → thèmes → événements → contenu libre, avec suivi du budget.

## Démarrer

```bash
cp .env.example .env      # facultatif, des valeurs par défaut existent
docker compose up -d --build
```

Ouvrez ensuite **http://localhost:8080** (changez `APP_PORT` dans `.env` pour un autre port).

Pour arrêter : `docker compose down`. Les données et les fichiers envoyés survivent à l'arrêt (volumes `db-data` et `uploads`). Pour tout effacer : `docker compose down -v`.

## Déploiement en production via Portainer

Le projet est pensé pour une stack Portainer en mode **Repository** : Portainer clone le dépôt Git (donc le `Dockerfile` et `server/` sont disponibles pour la construction) et gère le cycle de vie des conteneurs.

Réglages à faire une fois, dans la stack :

1. **Environment variables** — puisque `.env` n'est pas versionné, ajoutez-y `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `APP_PORT`.
2. **GitOps updates** → Mechanism **Polling**, intervalle 5 minutes. Suffisant pour un usage familial et n'exige aucun port ouvert sur la box. Le mode Webhook existe mais demande que Portainer soit joignable depuis Internet — à éviter sans solution comme Tailscale devant.

Ensuite, déployer une modification se résume à `git push` : Portainer récupère et reconstruit tout seul.

**Point de vigilance** : `docker-compose.override.yml` ne doit jamais être commité (il l'est dans `.gitignore`). Docker Compose le fusionne automatiquement s'il est présent, et il monte du code source absent sur le serveur — la stack casserait.

Après un déploiement, vérifiez avec `./scripts/smoke-test.sh http://adresse-du-serveur:8080`.

## Deux conteneurs

| Conteneur | Rôle |
|---|---|
| `db` | PostgreSQL 16, données dans le volume `db-data` |
| `app` | Node.js 20 + Express : API REST, envoi de fichiers, et le site lui-même |

Le schéma SQL se crée tout seul au premier démarrage (`server/src/schema.sql`), avec un onglet d'exemple « Fêtes de famille » et trois thèmes (Anniversaires, Mariages, Baptêmes).

## Comment ça s'organise

1. **Onglets** — en haut, à l'horizontale. Bouton « + Nouvel onglet » pour en ajouter, « Modifier l'onglet » pour changer son nom ou son image.
2. **Thèmes** — les cartes de la page d'accueil : anniversaires, mariages, baptêmes, ce que vous voulez. Nom, image et description modifiables.
3. **Événements** — dans un thème : *Anniversaire d'Elyan, 30 ans*. Date, lieu, nombre d'invités, description, photo de couverture.
4. **Budget** — un budget prévu, des lignes de dépenses cochables, et le reste à dépenser calculé en direct.
5. **Contenu** — le panneau de droite ajoute des éléments dans l'événement : note, image, champ libre, checklist, recette de cuisine, plan de décoration, impression 3D, document, prestataire, déroulé, lien. Chaque élément accepte aussi des champs supplémentaires via « + Champ ».

Tout s'enregistre automatiquement pendant la saisie, il n'y a pas de bouton « sauvegarder ».

## Ajouter un type de contenu

Ouvrez `server/public/app.js` et complétez `BLOCK_TYPES` :

```js
playlist: {
  label: 'Playlist', glyph: '♪', hint: 'Musique de la soirée',
  fields: [
    { key: 'lien', label: 'Lien', type: 'text' },
    { key: 'morceaux', label: 'Morceaux (un par ligne)', type: 'list' }
  ]
}
```

Types de champs disponibles : `text`, `textarea`, `list`, `image`, `file`, `checklist`. Aucune migration de base n'est nécessaire, le contenu est stocké en JSON.

## API

| Méthode | Route | Effet |
|---|---|---|
| GET / POST | `/api/tabs` | lister, créer un onglet |
| PATCH / DELETE | `/api/tabs/:id` | modifier, supprimer |
| GET | `/api/tabs/:id/themes` | thèmes d'un onglet |
| POST / PATCH / DELETE | `/api/themes[/:id]` | gérer les thèmes |
| GET | `/api/themes/:id` | thème + ses événements |
| GET | `/api/events/:id` | événement + blocs + dépenses |
| POST / PATCH / DELETE | `/api/events[/:id]` | gérer les événements |
| POST | `/api/events/:id/blocks` | ajouter un bloc de contenu |
| PATCH / DELETE | `/api/blocks/:id` | modifier, supprimer un bloc |
| POST | `/api/events/:id/expenses` | ajouter une dépense |
| PATCH / DELETE | `/api/expenses/:id` | modifier, supprimer |
| POST | `/api/upload` | envoyer une image ou un fichier |
| POST | `/api/reorder` | réordonner (`{ table, ids }`) |
| GET | `/api/search?q=` | rechercher un événement |

## À savoir

- L'application n'a **pas d'authentification** : gardez-la sur votre réseau local, ou placez un reverse proxy avec mot de passe devant si vous l'exposez sur Internet.
- Sauvegarde de la base : `docker compose exec db pg_dump -U evenements evenements > sauvegarde.sql`
- Les fichiers envoyés sont limités à 50 Mo par fichier (`server/src/index.js`).
