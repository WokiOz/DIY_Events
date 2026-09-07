#!/usr/bin/env bash
# Vérifie que l'API répond correctement. Crée puis supprime des données de test.
# Usage : ./scripts/smoke-test.sh [url]   (par défaut http://localhost:8080)

set -uo pipefail
BASE="${1:-http://localhost:8080}"
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

echo "Cible : $BASE"

check "la page se charge" "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/")"
check "app.js est servi"  "200" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/app.js")"

TAB=$(curl -s -X POST "$BASE/api/tabs" -H 'Content-Type: application/json' -d '{"name":"ZZ test"}')
TAB_ID=$(echo "$TAB" | json "['id']")
check "création d'un onglet" "ZZ test" "$(echo "$TAB" | json "['name']")"

THEME=$(curl -s -X POST "$BASE/api/themes" -H 'Content-Type: application/json' -d "{\"tab_id\":$TAB_ID,\"name\":\"Thème test\"}")
THEME_ID=$(echo "$THEME" | json "['id']")
check "création d'un thème" "Thème test" "$(echo "$THEME" | json "['name']")"

EVENT=$(curl -s -X POST "$BASE/api/events" -H 'Content-Type: application/json' -d "{\"theme_id\":$THEME_ID,\"name\":\"Evenement ZZTEST\",\"budget\":1000}")
EVENT_ID=$(echo "$EVENT" | json "['id']")
check "création d'un événement" "Evenement ZZTEST" "$(echo "$EVENT" | json "['name']")"

curl -s -X PATCH "$BASE/api/events/$EVENT_ID" -H 'Content-Type: application/json' -d '{"location":"Salle test","guests":30}' >/dev/null
check "modification partielle" "Salle test" "$(curl -s "$BASE/api/events/$EVENT_ID" | json "['location']")"

curl -s -X POST "$BASE/api/events/$EVENT_ID/blocks" -H 'Content-Type: application/json' \
  -d '{"type":"recette","title":"Gâteau","data":{"ingredients":["farine"]}}' >/dev/null
check "ajout d'un bloc" "farine" "$(curl -s "$BASE/api/events/$EVENT_ID" | json "['blocks'][0]['data']['ingredients'][0]")"

curl -s -X POST "$BASE/api/events/$EVENT_ID/expenses" -H 'Content-Type: application/json' -d '{"label":"Salle","amount":250}' >/dev/null
check "ajout d'une dépense" "250" "$(curl -s "$BASE/api/events/$EVENT_ID" | json "['expenses'][0]['amount']")"

check "recherche" "Evenement ZZTEST" "$(curl -s "$BASE/api/search?q=ZZTEST" | json "[0]['name']")"

echo test > /tmp/smoke-test-fichier.txt
check "envoi de fichier" "smoke-test-fichier.txt" "$(curl -s -F file=@/tmp/smoke-test-fichier.txt "$BASE/api/upload" | json "['name']")"
rm -f /tmp/smoke-test-fichier.txt

curl -s -X DELETE "$BASE/api/tabs/$TAB_ID" >/dev/null
check "suppression en cascade" "404" "$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/events/$EVENT_ID")"

echo
[ $FAILED -eq 0 ] && echo "Tout est vert." || echo "Des vérifications ont échoué."
exit $FAILED
