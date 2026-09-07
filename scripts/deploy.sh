#!/usr/bin/env bash
# Déploie le projet vers le serveur configuré dans deploy.conf.
# Usage : ./scripts/deploy.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f deploy.conf ]; then
  echo "Fichier deploy.conf absent."
  echo "Copiez deploy.conf.example en deploy.conf et renseignez SERVER_USER, SERVER_HOST, SERVER_PATH."
  exit 1
fi

# shellcheck source=/dev/null
source deploy.conf
: "${SERVER_USER:?SERVER_USER manquant dans deploy.conf}"
: "${SERVER_HOST:?SERVER_HOST manquant dans deploy.conf}"
: "${SERVER_PATH:?SERVER_PATH manquant dans deploy.conf}"
APP_PORT="${APP_PORT:-8080}"

TARGET="$SERVER_USER@$SERVER_HOST"

echo "→ Test de connexion à $TARGET"
if ! ssh -o ConnectTimeout=5 -o BatchMode=yes "$TARGET" "echo ok" >/dev/null 2>&1; then
  echo "Connexion SSH impossible sans mot de passe."
  echo "Configurez une clé une fois pour toutes : ssh-copy-id $TARGET"
  exit 1
fi

echo "→ Envoi des fichiers vers $SERVER_PATH"
ssh "$TARGET" "mkdir -p '$SERVER_PATH'"
rsync -az --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.env' \
  --exclude 'deploy.conf' \
  --exclude 'docker-compose.override.yml' \
  --exclude 'server/uploads' \
  ./ "$TARGET:$SERVER_PATH/"

echo "→ Construction et démarrage sur le serveur"
# shellcheck disable=SC2087
ssh "$TARGET" bash -s <<REMOTE
set -e
cd "$SERVER_PATH"
if [ ! -f .env ]; then
  cp .env.example .env
  echo "ATTENTION : .env créé avec le mot de passe par défaut."
  echo "Modifiez-le sur le serveur (nano $SERVER_PATH/.env) puis relancez ce script."
fi
docker compose up -d --build
REMOTE

echo "→ Vérification de l'API"
sleep 3
if ssh "$TARGET" bash -s -- "http://localhost:$APP_PORT" < scripts/smoke-test.sh; then
  echo
  echo "Déployé et vérifié : http://$SERVER_HOST:$APP_PORT"
else
  echo
  echo "Le déploiement a démarré mais des vérifications ont échoué."
  echo "Journaux : ssh $TARGET 'cd $SERVER_PATH && docker compose logs -f app'"
  exit 1
fi
