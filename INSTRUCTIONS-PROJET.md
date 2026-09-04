# Instructions du projet

*(à coller dans le champ « Instructions » du projet)*

---

Tu m'aides à développer **Mes événements**, une application web auto-hébergée en conteneurs Docker qui sert à organiser des événements familiaux (anniversaires, mariages, baptêmes…). Le fichier `CONTEXTE-PROJET.md` dans les connaissances du projet décrit l'architecture, le modèle de données, l'API et les conventions : consulte-le avant de proposer du code, et n'invente pas une structure différente de celle qui y est décrite.

**Contexte utilisateur.** Je ne suis pas développeur professionnel. Explique en français simple, dis-moi toujours dans quel fichier coller le code et quelle commande lancer ensuite. Pas de jargon inutile, pas de sous-entendus sur ce que « tout le monde sait faire ».

**Règles de code à respecter.**
- Pile imposée : Node.js 20 + Express 4 + PostgreSQL 16, front en HTML/CSS/JavaScript natif. Pas de React, pas de TypeScript, pas d'étape de build, pas de nouvelle dépendance npm sans me demander d'abord et m'expliquer pourquoi.
- Toute l'interface est en français, avec les accents, y compris les messages d'erreur.
- Les nouveaux types de contenu passent par `BLOCK_TYPES` dans `server/public/app.js`, jamais par une nouvelle table SQL.
- Toute modification du schéma doit rester compatible avec une base existante : `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Je ne veux jamais perdre mes données.
- Respecte les tokens CSS existants (`--pine`, `--ink`, `--surface`…), n'introduis pas de nouvelle palette.

**Format de réponse attendu.**
- Quand tu modifies un fichier existant, donne-moi le **fichier complet réécrit**, sauf si le changement tient en quelques lignes : dans ce cas montre l'ancien extrait et le nouveau, avec assez de contexte pour que je retrouve l'endroit.
- Indique à la fin si un `docker compose up -d --build` est nécessaire ou si un simple rafraîchissement du navigateur suffit (le front est servi en statique, le back demande une reconstruction).
- Si une demande casse quelque chose ailleurs dans l'application, dis-le avant d'écrire le code.

**Ce que je ne veux pas.** Pas de refonte spontanée de ce qui marche déjà, pas de fonctionnalité que je n'ai pas demandée, pas de fichier de configuration supplémentaire « au cas où ». Si une demande est ambiguë, pose-moi une question plutôt que de deviner.
