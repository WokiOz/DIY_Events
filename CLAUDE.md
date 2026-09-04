# CLAUDE.md

Application web auto-hébergée pour organiser des événements familiaux : onglets horizontaux → thèmes → événements → blocs de contenu, avec suivi du budget. Usage familial sur réseau local, un seul utilisateur, pas d'authentification.

Lis `CONTEXTE-PROJET.md` avant toute modification non triviale : il contient le modèle de données complet, la liste des routes API et les pièges connus.

## Commandes

```bash
docker compose up -d --build              # démarrer, ou reconstruire après modification du serveur
docker compose logs -f app                # journaux de l'application
docker compose restart app                # redémarrer sans reconstruire
docker compose exec db psql -U evenements evenements    # ouvrir la base
./scripts/smoke-test.sh                   # vérifier que l'API répond correctement
```

Avec `docker-compose.override.yml` en place, `server/src` et `server/public` sont montés dans le conteneur : modifier le front demande seulement un rafraîchissement du navigateur, modifier le serveur redémarre Node tout seul. Une reconstruction n'est nécessaire qu'en cas de changement dans `package.json` ou le `Dockerfile`.

## Architecture

- `server/src/index.js` — toutes les routes API dans un seul fichier. La route attrape-tout `app.get('*')` est en dernier : déclare toute nouvelle route API **avant** elle.
- `server/src/db.js` — pool `pg`, `initDatabase()` attend que Postgres réponde avant de rejouer le schéma.
- `server/src/schema.sql` — rejoué à chaque démarrage, doit rester idempotent (`IF NOT EXISTS`).
- `server/public/app.js` — tout le front : routage par hash, `BLOCK_TYPES`, rendu, sauvegarde automatique.
- `server/public/styles.css` — tokens CSS dans `:root`.

## Règles de code

- Pile imposée : Node 20 + Express 4 (ESM) + PostgreSQL 16, front en HTML/CSS/JS natif. Pas de React, pas de TypeScript, pas d'étape de build. Ne pas ajouter de dépendance npm sans demander.
- Interface entièrement en français, accents compris, y compris les messages d'erreur.
- Nouveau type de contenu = nouvelle entrée dans `BLOCK_TYPES` (`server/public/app.js`), jamais une nouvelle table SQL. Le contenu libre vit dans `blocks.data` en JSONB.
- Changement de schéma : `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Ne jamais casser une base existante, ne jamais lancer `docker compose down -v` : cela efface les données et les fichiers de l'utilisateur.
- Nouvelle colonne modifiable : l'ajouter à la liste blanche du `patch()` correspondant dans `index.js`, sinon la modification est silencieusement ignorée.
- Toute valeur venant de la base passe par `esc()` avant d'entrer dans une chaîne de gabarit.
- Les clés de `debounce()` doivent être uniques par champ (`` `event-${field}` ``), sinon une sauvegarde en annule une autre.
- Respecter les tokens CSS existants (`--pine`, `--ink`, `--surface`…), ne pas introduire de nouvelle palette.

## Vérifier son travail

Après une modification du serveur ou de la base, lance `./scripts/smoke-test.sh` et corrige avant de rendre la main. Après une modification du front, vérifie au minimum qu'aucune erreur n'apparaît dans la console du navigateur. Ne déclare pas qu'une chose fonctionne sans l'avoir exécutée.

## Style de réponse

Concis et précis. Pas d'introduction, pas de résumé final, pas de flatterie. Une seule solution, celle que tu juges la meilleure. Chemins de fichiers exacts et commandes complètes. Pas de code non demandé : ni option « au cas où », ni commentaire évident. Si une demande est ambiguë ou va casser quelque chose, dis-le en une phrase avant d'écrire du code.

L'utilisateur n'est pas développeur professionnel : explique en français simple et indique toujours quelle commande lancer ensuite.
