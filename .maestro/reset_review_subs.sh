#!/usr/bin/env bash
# Delete all subscriptions for review@subradar.ai on dev so add-flows never hit
# the free-plan limit (3). clearState wipes only local state; the backend
# accumulates across runs. Called before each add-heavy flow by the runner.
API="${E2E_API:-https://api-dev.subradar.ai/api/v1}"
EMAIL="${RESET_EMAIL:-review@subradar.ai}"
curl -s -X POST "$API/auth/otp/send" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"locale\":\"en\"}" >/dev/null
TOK=$(curl -s -X POST "$API/auth/otp/verify" -H "Content-Type: application/json" -d "{\"email\":\"$EMAIL\",\"code\":\"000000\"}" | python3 -c "import sys,json;print(json.load(sys.stdin).get('accessToken',''))" 2>/dev/null)
[ -z "$TOK" ] && { echo "reset: auth failed for $EMAIL"; exit 0; }
IDS=$(curl -s "$API/subscriptions" -H "Authorization: Bearer $TOK" | python3 -c "import sys,json; d=json.load(sys.stdin); arr=d if isinstance(d,list) else d.get('data') or d.get('subscriptions') or []; print('\n'.join(s.get('id','') for s in arr))" 2>/dev/null)
n=0
for id in $IDS; do
  [ -n "$id" ] && curl -s -o /dev/null -X DELETE "$API/subscriptions/$id" -H "Authorization: Bearer $TOK" && n=$((n+1))
done
echo "reset: deleted $n subs for $EMAIL"
