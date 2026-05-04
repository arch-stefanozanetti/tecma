#!/usr/bin/env bash
set -euo pipefail

TITLE="${CI_MERGE_REQUEST_TITLE:-}"

if [[ -z "${TITLE}" ]]; then
  echo "CI_MERGE_REQUEST_TITLE is empty."
  exit 1
fi

# Examples:
# feat(auth): add refresh token rotation
# fix(rbac): block cross-workspace fallback
CONVENTIONAL_REGEX='^(feat|fix|docs|refactor|test|chore|security|ci|build)(\([a-z0-9._-]+\))?: .{3,}$'

if [[ "${TITLE}" =~ ${CONVENTIONAL_REGEX} ]]; then
  echo "MR title is valid: ${TITLE}"
  exit 0
fi

echo "Invalid MR title: ${TITLE}"
echo "Expected Conventional Commit-like title:"
echo "  <type>(optional-scope): short description"
echo "Types: feat|fix|docs|refactor|test|chore|security|ci|build"
exit 1
