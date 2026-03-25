#!/usr/bin/env bash
set -euo pipefail

# Enforce GitHub branch protection on main for FollowUp 3.0 production flow.
# Required env vars:
# - GITHUB_TOKEN: token with repo admin permission
# Optional:
# - GITHUB_OWNER (default: arch-stefanozanetti)
# - GITHUB_REPO (default: tecma)

OWNER="${GITHUB_OWNER:-arch-stefanozanetti}"
REPO="${GITHUB_REPO:-tecma}"
BRANCH="main"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "GITHUB_TOKEN mancante"
  exit 1
fi

api="https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection"

read -r -d '' payload <<'JSON' || true
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "FE Quality Gate",
      "BE Quality Gate",
      "Aggregate + gate"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}
JSON

curl -sS -L \
  -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "${api}" \
  -d "${payload}" >/dev/null

echo "Branch protection applicata su ${OWNER}/${REPO}:${BRANCH}"
