#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:3001}"
CJ=/tmp/cg-smoke-cookies.txt
rm -f "$CJ"

echo "== health =="
curl -sS "$BASE/api/health" | head -c 200; echo

echo "== signin =="
curl -sS -c "$CJ" -X POST "$BASE/api/auth/sign-in/email" \
  -H 'Content-Type: application/json' \
  -d '{"email":"rbtm2006@me.com","password":"TestPass123"}' | head -c 300; echo

check() {
  local name="$1"; local url="$2"; local want="${3:-200}"
  local code; code=$(curl -sS -b "$CJ" -o /dev/null -w '%{http_code}' "$BASE$url")
  if [ "$code" = "$want" ]; then echo "OK   $name ($code)"; else echo "FAIL $name ($code) $BASE$url"; fi
}

check "home" "/home"
check "applications" "/applications"
check "applications list" "/applications?new=1"
check "profile" "/profile"
check "interview" "/interview"
check "documents" "/documents"
check "research" "/research"
check "network" "/tools/network"
check "admin" "/tools/admin"
check "follow-ups" "/follow-ups"
check "import" "/applications/import"

post() {
  local url="$1"; shift
  curl -sS -b "$CJ" -X POST -H "Origin: $BASE" -H 'Content-Type: application/x-www-form-urlencoded' "$BASE$url" "$@"
}

echo "== create application =="
CREATE=$(post "/applications?/create" --data-urlencode 'company=Smoke Corp' --data-urlencode 'title=Smoke Role' --data-urlencode 'location=Remote' --data-urlencode 'workMode=remote' --data-urlencode 'jobDescription=Test JD')
echo "$CREATE" | head -c 200
APPID=$(echo "$CREATE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["location"].split("/")[-1])')
echo "app id: $APPID"

if [ -n "$APPID" ]; then
  check "detail" "/applications/$APPID"
  echo "== change stage =="
  post "/applications/$APPID?/stage" --data-urlencode 'stage=interviewing' --data-urlencode 'outcome=' > /dev/null
  check "detail after stage" "/applications/$APPID"
  echo "== add interview =="
  INT=$(post "/applications/$APPID?/addInterview" --data-urlencode 'round=screen' --data-urlencode 'scheduledAt=2026-11-10T10:00' --data-urlencode 'location=Zoom' --data-urlencode 'interviewerName=Alex')
  echo "$INT" | head -c 200
  INTID=$(echo "$INT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["location"].split("/")[-1])')
  echo "interview id: $INTID"
  if [ -n "$INTID" ]; then
    check "interview detail" "/interview/$INTID"
  fi
  echo "== add research note =="
  post "/applications/$APPID?/addResearch" --data-urlencode 'title=Company culture' --data-urlencode 'body=Great team' --data-urlencode 'sourceUrl=https://example.com' > /dev/null
  echo "== add contact =="
  post "/tools/network?/add" --data-urlencode 'name=Jane Doe' --data-urlencode 'email=jane@example.com' --data-urlencode 'role=Recruiter' > /dev/null
  echo "== create document =="
  DOC=$(post "/documents?/create" --data-urlencode 'title=Smoke Resume' --data-urlencode 'kind=resume' --data-urlencode 'bodyMarkdown=# Smoke Resume\n\nHello' --data-urlencode "applicationId=$APPID")
  echo "$DOC" | head -c 200
  DOCID=$(echo "$DOC" | python3 -c 'import sys,json; print(json.load(sys.stdin)["location"].split("/")[-1])')
  echo "doc id: $DOCID"
  if [ -n "$DOCID" ]; then
    check "document detail" "/documents/$DOCID"
    echo "== download PDF =="
    PDF=$(curl -sS -b "$CJ" -o /tmp/smoke.pdf -w '%{http_code}' "$BASE/documents/$DOCID/download")
    echo "pdf http: $PDF"
    if [ "$PDF" = "200" ]; then
      file /tmp/smoke.pdf
    fi
  fi
  echo "== archive =="
  post "/applications/$APPID?/archive" --data-urlencode 'archive=1' > /dev/null || true
fi

echo "== profile update =="
post "/profile?/updateProfile" --data-urlencode 'name=Jeremy Guill' --data-urlencode 'phone=555-1234' --data-urlencode 'desiredTitles=Product Designer, Engineering Manager' > /dev/null
check "profile after update" "/profile"

echo "== admin save =="
post "/tools/admin?/save" --data-urlencode 'ai.provider=openai' --data-urlencode 'ai.model=gpt-4o-mini' --data-urlencode 'ai.apiKey=' > /dev/null
check "admin after save" "/tools/admin"

echo "== sign out =="
curl -sS -b "$CJ" -X POST "$BASE/api/auth/sign-out" -H "Origin: $BASE" | head -c 200; echo
check "home after signout" "/home" "302"
check "home after signout alt" "/home" "303"

echo "SMOKE DONE"