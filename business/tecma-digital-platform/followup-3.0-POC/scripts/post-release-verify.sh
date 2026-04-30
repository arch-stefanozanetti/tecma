#!/usr/bin/env bash
set -euo pipefail

BE_URL="${BE_URL:-http://localhost:8080}"
FE_URL="${FE_URL:-http://localhost:5177}"
AUTH_BEARER="${AUTH_BEARER:-}"

say() {
  printf '[post-release] %s\n' "$1"
}

expect_2xx() {
  local url="$1"
  local code
  code="$(curl -sS -o /tmp/post_release_body.$$ -w '%{http_code}' "$url")"
  if [[ "$code" != 2* ]]; then
    say "FAIL $url -> HTTP $code"
    cat /tmp/post_release_body.$$ || true
    rm -f /tmp/post_release_body.$$ || true
    exit 1
  fi
  rm -f /tmp/post_release_body.$$ || true
  say "OK $url -> HTTP $code"
}

say "BE URL: $BE_URL"
say "FE URL: $FE_URL"

say "Check 1/6: BE health"
expect_2xx "$BE_URL/v1/health"

say "Check 2/6: BE OpenAPI"
expect_2xx "$BE_URL/v1/openapi.json"

say "Check 3/6: FE login page reachable"
expect_2xx "$FE_URL/login"

say "Check 4/6: FE login page semantic marker"
if ! curl -sS "$FE_URL/login" | rg -qi "Accedi|Followup|Tecma"; then
  say "FAIL semantic marker not found in FE login HTML"
  exit 1
fi
say "OK FE semantic marker"

say "Check 5/6: Auth endpoint behaviour"
if [[ -n "$AUTH_BEARER" ]]; then
  code="$(curl -sS -o /tmp/post_release_auth.$$ -w '%{http_code}' -H "Authorization: Bearer $AUTH_BEARER" "$BE_URL/v1/auth/me")"
  if [[ "$code" != "200" ]]; then
    say "FAIL /v1/auth/me with bearer returned HTTP $code"
    cat /tmp/post_release_auth.$$ || true
    rm -f /tmp/post_release_auth.$$ || true
    exit 1
  fi
  rm -f /tmp/post_release_auth.$$ || true
  say "OK /v1/auth/me with bearer"
else
  code="$(curl -sS -o /tmp/post_release_auth.$$ -w '%{http_code}' "$BE_URL/v1/auth/me")"
  rm -f /tmp/post_release_auth.$$ || true
  if [[ "$code" != "401" ]]; then
    say "FAIL /v1/auth/me expected 401 without token, got $code"
    exit 1
  fi
  say "OK /v1/auth/me rejects anonymous requests"
fi

say "Check 6/6: Observability metrics endpoint (optional)"
code="$(curl -sS -o /tmp/post_release_metrics.$$ -w '%{http_code}' "$BE_URL/metrics" || true)"
if [[ "$code" == 2* ]]; then
  say "OK /metrics reachable"
else
  say "WARN /metrics not reachable (HTTP $code). Validate via collector/APM dashboard."
fi
rm -f /tmp/post_release_metrics.$$ || true

say "SUCCESS: post-release verification completed"
