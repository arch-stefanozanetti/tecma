#!/usr/bin/env bash
set -euo pipefail

# Allowed patterns:
# - feat/FUP3-123-short-desc
# - fix/FUP3-123-short-desc
# - chore/FUP3-123-short-desc
# - hotfix/FUP3-123-short-desc
# - release/v1.2.3
ALLOWED_REGEX='^(feat|fix|docs|refactor|test|chore|security|ci|build|hotfix)\/[A-Z0-9]+-[0-9]+-[a-z0-9._-]+$|^release\/v[0-9]+\.[0-9]+\.[0-9]+$'

BRANCH_NAME="${CI_MERGE_REQUEST_SOURCE_BRANCH_NAME:-${CI_COMMIT_BRANCH:-}}"

if [[ -z "${BRANCH_NAME}" ]]; then
  echo "Cannot determine branch name from CI environment."
  exit 1
fi

if [[ "${BRANCH_NAME}" == "${CI_DEFAULT_BRANCH:-main}" ]]; then
  echo "Default branch detected, skipping branch-name validation."
  exit 0
fi

if [[ "${BRANCH_NAME}" =~ ${ALLOWED_REGEX} ]]; then
  echo "Branch name is valid: ${BRANCH_NAME}"
  exit 0
fi

echo "Invalid branch name: ${BRANCH_NAME}"
echo "Expected one of:"
echo "  - <type>/<TICKET>-<slug>  (e.g. feat/FUP3-123-auth-refresh)"
echo "    where <type> in feat|fix|docs|refactor|test|chore|security|ci|build|hotfix"
echo "  - release/v<major>.<minor>.<patch>"
exit 1
