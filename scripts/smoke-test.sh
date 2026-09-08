#!/usr/bin/env bash
# Vérifie que l'API répond correctement. Crée puis supprime des données de test.
# Usage : ./scripts/smoke-test.sh [url]   (par défaut http://localhost:3000)
# Identifiant admin utilisé pour se connecter : variables SMOKE_USER / SMOKE_PASSWORD
# (par défaut helena / helena, le mot de passe temporaire d'une base fraîche).

set -uo pipefail
BASE="${1:-http://localhost:3000}"
SMOKE_USER="${SMOKE_USER:-helena}"
SMOKE_PASSWORD="${SMOKE_PASSWORD:-helena}"
COOKIES=$(mktemp)
trap 'rm -f "$COOKIES"' EXIT
FAILED=0

check() { # check "description" "attendu" "obtenu"
  if [ "$2" = "$3" ]; then
    echo "  ok   $1"
  else
    echo "  ÉCHEC $1 — attendu « $2 », obtenu « $3 »"
    FAILED=1
  fi
}

json() { # json "['clé']" < flux
  python3 -c "import sys,json;print(eval('d'+sys.argv[1],{'d':json.load(sys.stdin)}))" "$1" 2>/dev/null || echo "ERREUR"
}

cget()   { curl -s -b "$COOKIES" -c "$COOKIES" "$@"; }
cpost()  { curl -s -b "$COOKIES" -c "$COOKIES" -X POST -H 'Content-Type: application/json' "$@"; }
cpatch() { curl -s -b "$COOKIES" -c "$COOKIES" -X PATCH -H 'Content-Type: application/json' "$@"; }
cdel()   { curl -s -b "$COOKIES" -c "$COOKIES" -X DELETE "$@"; }

echo "Cible : $BASE"

check "la page se charge" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"
check "app.js est servi"  "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/app.js")"
check "API sans connexion refusée" "401" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/tabs")"

LOGIN=$(cpost "$BASE/api/login" -d "{\"username\":\"$SMOKE_USER\",\"password\":\"$SMOKE_PASSWORD\"}")
check "connexion admin ($SMOKE_USER)" "$SMOKE_USER" "$(echo "$LOGIN" | json "['username']")"

TAB=$(cpost "$BASE/api/tabs" -d '{"name":"ZZ test"}')
TAB_ID=$(echo "$TAB" | json "['id']")
check "création d'un onglet" "ZZ test" "$(echo "$TAB" | json "['name']")"

THEME=$(cpost "$BASE/api/themes" -d "{\"tab_id\":$TAB_ID,\"name\":\"Thème test\"}")
THEME_ID=$(echo "$THEME" | json "['id']")
check "création d'un thème" "Thème test" "$(echo "$THEME" | json "['name']")"

EVENT=$(cpost "$BASE/api/events" -d "{\"theme_id\":$THEME_ID,\"name\":\"Evenement ZZTEST\",\"budget\":1000}")
EVENT_ID=$(echo "$EVENT" | json "['id']")
check "création d'un événement" "Evenement ZZTEST" "$(echo "$EVENT" | json "['name']")"

cpatch "$BASE/api/events/$EVENT_ID" -d '{"location":"Salle test","guests":30}' >/dev/null
check "modification partielle" "Salle test" "$(cget "$BASE/api/events/$EVENT_ID" | json "['location']")"

cpost "$BASE/api/events/$EVENT_ID/blocks" -d '{"type":"recette","title":"Gâteau","data":{"ingredients":["farine"]}}' >/dev/null
check "ajout d'un bloc" "farine" "$(cget "$BASE/api/events/$EVENT_ID" | json "['blocks'][0]['data']['ingredients'][0]")"

cpost "$BASE/api/events/$EVENT_ID/expenses" -d '{"label":"Salle","amount":250}' >/dev/null
check "ajout d'une dépense" "250" "$(cget "$BASE/api/events/$EVENT_ID" | json "['expenses'][0]['amount']")"

check "recherche" "Evenement ZZTEST" "$(cget "$BASE/api/search?q=ZZTEST" | json "[0]['name']")"

echo test > /tmp/smoke-test-fichier.txt
check "envoi de fichier" "smoke-test-fichier.txt" "$(curl -s -b "$COOKIES" -F file=@/tmp/smoke-test-fichier.txt "$BASE/api/upload" | json "['name']")"
rm -f /tmp/smoke-test-fichier.txt

NOM_COMPTE="zztest$$"
COMPTE=$(cpost "$BASE/api/users" -d "{\"username\":\"$NOM_COMPTE\",\"password\":\"zztest1234\"}")
COMPTE_ID=$(echo "$COMPTE" | json "['id']")
check "création d'un compte lecture seule" "$NOM_COMPTE" "$(echo "$COMPTE" | json "['username']")"

LOGIN_LECTURE=$(curl -s -c /tmp/smoke-test-cookies-lecture -X POST -H 'Content-Type: application/json' \
  "$BASE/api/login" -d "{\"username\":\"$NOM_COMPTE\",\"password\":\"zztest1234\"}")
check "connexion du compte lecture seule" "lecture" "$(echo "$LOGIN_LECTURE" | json "['role']")"
check "compte lecture seule : aucun événement visible avant permission" "[]" \
  "$(curl -s -b /tmp/smoke-test-cookies-lecture "$BASE/api/tabs")"

cpost "$BASE/api/users/$COMPTE_ID/permissions/$EVENT_ID" >/dev/null
check "compte lecture seule : événement visible après permission" "200" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/smoke-test-cookies-lecture "$BASE/api/events/$EVENT_ID")"
check "compte lecture seule : écriture refusée" "403" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/smoke-test-cookies-lecture -X PATCH -H 'Content-Type: application/json' \
     "$BASE/api/events/$EVENT_ID" -d '{"name":"piraté"}')"

cpatch "$BASE/api/users/$COMPTE_ID" -d '{"active":false}' >/dev/null
check "révocation : session déjà ouverte coupée" "401" \
  "$(curl -s -o /dev/null -w '%{http_code}' -b /tmp/smoke-test-cookies-lecture "$BASE/api/tabs")"
cdel "$BASE/api/users/$COMPTE_ID" >/dev/null
rm -f /tmp/smoke-test-cookies-lecture

cdel "$BASE/api/tabs/$TAB_ID" >/dev/null
check "suppression en cascade" "404" "$(cget -o /dev/null -w '%{http_code}' "$BASE/api/events/$EVENT_ID")"

echo
[ $FAILED -eq 0 ] && echo "Tout est vert." || echo "Des vérifications ont échoué."
exit $FAILED
