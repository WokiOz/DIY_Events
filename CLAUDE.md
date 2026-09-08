# CLAUDE.md

Application web auto-hébergée pour organiser des événements familiaux : onglets horizontaux → thèmes → événements → blocs de contenu, avec suivi du budget. Usage familial. Authentification par identifiant/mot de passe : deux comptes admin (accès complet) et des comptes lecture seule révocables, dont la visibilité se règle événement par événement.

Lis `CONTEXTE-PROJET.md` avant toute modification non triviale : il contient le modèle de données complet, la liste des routes API et les pièges connus.

## Commandes

```bash
docker compose up -d --build              # démarrer, ou reconstruire après modification du serveur
docker compose logs -f app                # journaux de l'application
docker compose restart app                # redémarrer sans reconstruire
docker compose exec db psql -U evenements evenements    # ouvrir la base
./scripts/smoke-test.sh                   # vérifier que l'API répond correctement
```

`docker-compose.yml` ne construit plus l'image (`image: ghcr.io/...`, pas de `build:`) : en local, copier `docker-compose.override.yml.example` en `docker-compose.override.yml` (voir README « Démarrer ») pour retrouver `build: ./server`, le montage de `server/src`/`server/public` et le rechargement à chaud. Une reconstruction locale (`docker compose up -d --build`) n'est nécessaire qu'en cas de changement dans `package.json` ou le `Dockerfile`.

## Déploiement

En production, la stack tourne dans Portainer en mode **Repository**, mais Portainer ne construit rien : `.github/workflows/build-image.yml` construit l'image sur push `main` touchant `server/**`, la publie sur `ghcr.io/wokioz/diy_events-app:<sha>`, et committe lui-même ce tag dans `docker-compose.yml`. Portainer (GitOps updates en Polling) ne fait donc que tirer l'image taguée au poll suivant — `git push` suffit toujours, mais il n'y a plus de build côté Portainer donc plus de flakiness de cache. Ne jamais committer `docker-compose.override.yml` (il est dans `.gitignore`) : Docker Compose le fusionnerait automatiquement et casserait le déploiement en rajoutant un `build:` et des volumes de code source absents sur le serveur. Les variables d'environnement de production (`POSTGRES_PASSWORD`, `APP_PORT`…) se définissent dans l'interface Portainer, pas dans un fichier commité.

## Architecture

- `server/src/index.js` — toutes les routes API dans un seul fichier. `app.use('/api', authentifier)` protège tout ce qui suit ; les routes d'écriture portent en plus `exigerAdmin`. La route attrape-tout `app.get('*')` est en dernier : déclare toute nouvelle route API **avant** elle.
- `server/src/auth.js` — cookie de session signé (HMAC, `SESSION_SECRET`), middlewares `authentifier`/`exigerAdmin`.
- `server/src/mots-de-passe.js` — hachage `scrypt` (`node:crypto`, pas de dépendance).
- `server/src/db.js` — pool `pg`, `initDatabase()` attend que Postgres réponde, rejoue le schéma, puis crée les comptes admin `helena`/`elyan` si la table `users` est vide.
- `server/src/schema.sql` — rejoué à chaque démarrage, doit rester idempotent (`IF NOT EXISTS`).
- `server/public/app.js` — tout le front : routage par hash, `BLOCK_TYPES`, rendu, sauvegarde automatique, écrans de connexion, panneau `#/comptes`.
- `server/public/styles.css` — tokens CSS dans `:root`.
- `.github/workflows/build-image.yml` — construit et publie l'image `app` sur ghcr.io à chaque push `main` touchant `server/**`, puis committe le nouveau tag dans `docker-compose.yml`.

## Règles de code

- Pile imposée : Node 20 + Express 4 (ESM) + PostgreSQL 16, front en HTML/CSS/JS natif. Pas de React, pas de TypeScript, pas d'étape de build. Ne pas ajouter de dépendance npm sans demander.
- Interface entièrement en français, accents compris, y compris les messages d'erreur.
- Nouveau type de contenu = nouvelle entrée dans `BLOCK_TYPES` (`server/public/app.js`), jamais une nouvelle table SQL. Le contenu libre vit dans `blocks.data` en JSONB.
- Changement de schéma : `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Ne jamais casser une base existante, ne jamais lancer `docker compose down -v` : cela efface les données et les fichiers de l'utilisateur.
- Nouvelle colonne modifiable : l'ajouter à la liste blanche du `patch()` correspondant dans `index.js`, sinon la modification est silencieusement ignorée.
- Toute valeur venant de la base passe par `esc()` avant d'entrer dans une chaîne de gabarit.
- Les clés de `debounce()` doivent être uniques par champ (`` `event-${field}` ``), sinon une sauvegarde en annule une autre.
- Respecter les tokens CSS existants (`--pine`, `--ink`, `--surface`…), ne pas introduire de nouvelle palette.
- Toute nouvelle route de mutation (POST/PATCH/DELETE) doit porter `exigerAdmin`. Toute nouvelle route de lecture doit filtrer pour un compte `lecture` via la table `permissions` (voir `/api/tabs`, `/api/themes/:id`, `/api/events/:id` dans `index.js` comme modèle), sinon un compte lecture seule verrait des données non autorisées.

## Vérifier son travail

Après une modification du serveur ou de la base, lance `./scripts/smoke-test.sh` et corrige avant de rendre la main. Le script se connecte lui-même (`SMOKE_USER`/`SMOKE_PASSWORD`, par défaut `helena`/`helena` — inutile en local si le mot de passe temporaire n'a pas été changé). Après une modification du front, vérifie au minimum qu'aucune erreur n'apparaît dans la console du navigateur. Ne déclare pas qu'une chose fonctionne sans l'avoir exécutée.

## Style de réponse

Concis et précis. Pas d'introduction, pas de résumé final, pas de flatterie. Une seule solution, celle que tu juges la meilleure. Chemins de fichiers exacts et commandes complètes. Pas de code non demandé : ni option « au cas où », ni commentaire évident. Si une demande est ambiguë ou va casser quelque chose, dis-le en une phrase avant d'écrire du code.

L'utilisateur n'est pas développeur professionnel : explique en français simple et indique toujours quelle commande lancer ensuite.
