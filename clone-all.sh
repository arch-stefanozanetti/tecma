#!/usr/bin/env bash

set -uo pipefail

GITLAB_HOST="https://gitlab.tecmasolutions.com"

# Primo branch che esiste su origin in quest'ordine viene usato (stop alla prima hit).
BRANCH_PRIORITY=(
  develop
  biz-tecma-prod
  main
  master
  release
)

# Dopo BRANCH_PRIORITY: branch per progetto tipo biz-tecma-prod.<slug>, dove <slug> è il nome
# della cartella del repo (ultimo segmento del path), es. fe-tecma-followup → biz-tecma-prod.fe-tecma-followup.
BRANCH_PER_PROJECT_PREFIX="biz-tecma-prod"

GROUP_PATHS=(
  "business"
  "architecture"
)

# path_with_namespace GitLab: stesso flusso degli altri repo, ma ogni branch remoto
# ha anche una worktree in "${namespace}.__wt__/<branch-sanitized>/" (il main resta su priority).
REPOS_WORKTREES_ALL_BRANCHES=(
  "business/tecma-digital-platform/helm-tecma"
)

TARGET_DIR="$(cd "$(dirname "$0")" && pwd)"

# Opzioni CLI (con argv vuoto: come -j 6 --skip-group-list)
SKIP_GROUP_LIST=0
PARALLEL_JOBS=1
if [[ $# -eq 0 ]]; then
  set -- -j 6 --skip-group-list
fi
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-group-list)
      SKIP_GROUP_LIST=1
      shift
      ;;
    --jobs|-j)
      shift
      if [[ -z "${1:-}" ]] || ! [[ "$1" =~ ^[1-9][0-9]*$ ]]; then
        echo "[clone-all] --jobs richiede un intero >= 1" >&2
        exit 1
      fi
      PARALLEL_JOBS="$1"
      shift
      ;;
    *)
      echo "[clone-all] opzione sconosciuta: $1 (supportate: --skip-group-list, --jobs N | -j N)" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${GITLAB_TOKEN:-}" ]]; then
  read -rsp "Inserisci il tuo GitLab Personal Access Token: " GITLAB_TOKEN
  echo
fi

api() {
  curl -fsSL --header "PRIVATE-TOKEN: $GITLAB_TOKEN" "$@"
}

# Esito repo: in sequenza aggiorna i contatori; in parallelo scrive un file in OUTCOME_PART_DIR (merge centralizzato a fine run).
# Arg: tipo NEW | UPDATED | SKIP, namespace, motivo (solo per SKIP).
record_outcome() {
  local kind="$1"
  local ns="$2"
  local reason="${3:-}"
  if [[ -n "${OUTCOME_PART_DIR:-}" ]]; then
    local f
    f=$(mktemp "${OUTCOME_PART_DIR}/out.XXXXXX")
    printf '%s\t%s\t%s\n' "$kind" "$ns" "$reason" > "$f"
  else
    case "$kind" in
      NEW) NEW=$((NEW + 1)) ;;
      UPDATED) UPDATED=$((UPDATED + 1)) ;;
      SKIP)
        SKIPPED=$((SKIPPED + 1))
        SKIPPED_DETAIL+=("${ns}"$'\t'"${reason}")
        ;;
      *)
        echo "[clone-all] record_outcome: tipo non valido: $kind" >&2
        ;;
    esac
  fi
}

register_skip() {
  record_outcome SKIP "$1" "$2"
}

aggregate_outcome_parts() {
  local dir="$1"
  local f kind ns reason
  shopt -s nullglob
  for f in "$dir"/out.*; do
    [[ -f "$f" ]] || continue
    IFS=$'\t' read -r kind ns reason < "$f"
    case "$kind" in
      NEW) NEW=$((NEW + 1)) ;;
      UPDATED) UPDATED=$((UPDATED + 1)) ;;
      SKIP)
        SKIPPED=$((SKIPPED + 1))
        SKIPPED_DETAIL+=("${ns}"$'\t'"${reason}")
        ;;
    esac
  done
  shopt -u nullglob
  rm -rf "$dir"
}

# ── Elenca tutti i gruppi accessibili (utile per debug) ──
list_accessible_groups() {
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Gruppi accessibili con il tuo token:"
  local page=1
  while true; do
    local result
    result=$(api "${GITLAB_HOST}/api/v4/groups?per_page=100&page=${page}&all_available=true")
    local count
    count=$(echo "$result" | python3 -c "import json,sys; print(len(json.loads(sys.stdin.read(), strict=False)))")
    echo "$result" | python3 -c "
import json, sys
for g in json.loads(sys.stdin.read(), strict=False):
    print('  •', g['full_path'])
"
    [[ "$count" -lt 100 ]] && break
    ((page++))
  done
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

get_group_id() {
  local group_path="$1"
  local encoded
  encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1],safe=''))" "$group_path")
  local response
  response=$(curl -sL --header "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    "${GITLAB_HOST}/api/v4/groups/${encoded}")
  echo "$response" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read(), strict=False)
if 'id' in data:
    print(data['id'])
else:
    import sys; sys.exit(1)
"
}

fetch_projects() {
  local group_id="$1"
  local page=1

  while true; do
    local result
    result=$(api "${GITLAB_HOST}/api/v4/groups/${group_id}/projects?include_subgroups=true&per_page=100&page=${page}&archived=false")

    local count
    count=$(echo "$result" | python3 -c "
import json, sys
data = json.loads(sys.stdin.read(), strict=False)
print(len(data))
")

    echo "$result" | GITLAB_TOKEN="$GITLAB_TOKEN" GITLAB_HOST="$GITLAB_HOST" python3 -c "
import json, sys, os

token = os.environ['GITLAB_TOKEN']
host  = os.environ['GITLAB_HOST'].replace('https://', '')

for p in json.loads(sys.stdin.read(), strict=False):
    url = 'https://oauth2:' + token + '@' + host + '/' + p['path_with_namespace'] + '.git'
    print(url + '\t' + p['path_with_namespace'])
"

    [[ "$count" -lt 100 ]] && break
    ((page++))
  done
}

# Risolve il branch da usare: stesso ordine di prima, senza chiamate di rete ripetute se il repo
# locale ha già i ref (dopo clone o fetch). Con solo URL: un solo git ls-remote --heads.
pick_priority_branch() {
  local spec="$1"
  local b slug per_project heads

  if [[ -d "${spec}/.git" ]]; then
    for b in "${BRANCH_PRIORITY[@]}"; do
      if git -C "$spec" rev-parse --verify --quiet "refs/remotes/origin/${b}" &>/dev/null; then
        echo "$b"
        return 0
      fi
    done
    slug=$(basename "$spec")
    per_project="${BRANCH_PER_PROJECT_PREFIX}.${slug}"
    if [[ "$per_project" != "${BRANCH_PER_PROJECT_PREFIX}." ]] \
      && git -C "$spec" rev-parse --verify --quiet "refs/remotes/origin/${per_project}" &>/dev/null; then
      echo "$per_project"
      return 0
    fi
  else
    heads=$(git ls-remote --heads "$spec" 2>/dev/null | awk '{print $2}' | sed 's#refs/heads/##' | sort -u)
    [[ -z "$heads" ]] && return 1
    for b in "${BRANCH_PRIORITY[@]}"; do
      if grep -Fxq "$b" <<< "$heads"; then
        echo "$b"
        return 0
      fi
    done
    slug=$(basename "$spec" .git)
    per_project="${BRANCH_PER_PROJECT_PREFIX}.${slug}"
    if [[ "$per_project" != "${BRANCH_PER_PROJECT_PREFIX}." ]] && grep -Fxq "$per_project" <<< "$heads"; then
      echo "$per_project"
      return 0
    fi
  fi
  return 1
}

is_worktrees_repo() {
  local ns="$1"
  local p
  for p in "${REPOS_WORKTREES_ALL_BRANCHES[@]}"; do
    [[ "$ns" == "$p" ]] && return 0
  done
  return 1
}

worktree_safe_dir() {
  local wt_root="$1"
  local branch="$2"
  echo "${wt_root}/${branch//\//__}"
}

# Allinea il branch locale $br a origin/$br nel repo principale (serve a git worktree add $br).
ensure_local_branch_at_origin() {
  local dest="$1" br="$2"
  if ! git -C "$dest" rev-parse --verify --quiet "refs/remotes/origin/${br}" &>/dev/null; then
    return 1
  fi
  if git -C "$dest" show-ref --verify --quiet "refs/heads/${br}"; then
    git -C "$dest" branch -f "$br" "origin/${br}" &>/dev/null
  else
    git -C "$dest" branch --track "$br" "origin/${br}" &>/dev/null
  fi
}

# Crea o aggiorna worktree per ogni branch remoto tranne $primary (già nel path principale).
sync_worktrees_for_all_remote_branches() {
  local dest="$1"
  local namespace="$2"
  local primary="$3"
  local wt_root="${TARGET_DIR}/${namespace}.__wt__"

  mkdir -p "$wt_root"

  local remote_branches
  remote_branches=$(git -C "$dest" ls-remote --heads origin | awk '{print $2}' | sed 's#refs/heads/##')
  if [[ -z "$remote_branches" ]]; then
    echo "  [WARN]  nessun branch remoto da espandere in worktree: $namespace"
    return 0
  fi

  local b wt_path
  while IFS= read -r b; do
    [[ -z "$b" ]] && continue
    [[ "$b" == "$primary" ]] && continue
    wt_path="$(worktree_safe_dir "$wt_root" "$b")"
    if [[ -e "$wt_path" ]] && git -C "$wt_path" rev-parse --is-inside-work-tree &>/dev/null; then
      git -C "$wt_path" checkout "$b" &>/dev/null || true
      # ref già aggiornato dal fetch nel repo principale: evita fetch di rete per worktree
      if ! git -C "$wt_path" merge --ff-only "origin/${b}" &>/dev/null; then
        if ! git -C "$wt_path" pull origin "$b" --ff-only &>/dev/null; then
          echo "  [WARN]  worktree pull --ff-only fallito: $namespace ($b)"
        fi
      fi
    else
      ensure_local_branch_at_origin "$dest" "$b" || {
        echo "  [WARN]  nessun origin/$b, salto worktree"
        continue
      }
      if ! git -C "$dest" worktree add "$wt_path" "$b" &>/dev/null; then
        echo "  [WARN]  worktree add fallito: $namespace → $b"
      fi
    fi
  done <<< "$remote_branches"

  git -C "$dest" worktree prune &>/dev/null || true
}

clone_or_pull_worktrees_all() {
  local clone_url="$1"
  local namespace="$2"
  local dest="${TARGET_DIR}/${namespace}"

  mkdir -p "$(dirname "$dest")"

  if [[ -d "${dest}/.git" ]]; then
    echo "  [update] $namespace — modalità worktree (fetch di tutti i branch + worktree per ciascuno)"
    git -C "$dest" remote set-head origin -a 2>/dev/null || true
    if ! git -C "$dest" fetch origin --prune 2>/dev/null; then
      echo "  [WARN]  fetch fallito: $namespace"
      register_skip "$namespace" "fetch origin fallito (worktree)"
      return
    fi
    local primary
    primary=$(pick_priority_branch "$dest") || {
      echo "  [SKIP]  nessun branch tra ${BRANCH_PRIORITY[*]} su origin: $namespace"
      register_skip "$namespace" "nessun branch in priorità su origin (worktree)"
      return
    }
    echo "          directory principale (priority): $primary"
    if ! git -C "$dest" checkout "$primary" 2>/dev/null; then
      echo "  [WARN]  checkout fallito: $namespace ($primary)"
      register_skip "$namespace" "checkout fallito: $primary (worktree)"
      return
    fi
    if ! git -C "$dest" pull origin "$primary" --ff-only &>/dev/null; then
      echo "  [WARN]  pull --ff-only fallito: $namespace ($primary)"
      register_skip "$namespace" "pull --ff-only fallito su $primary (worktree)"
      return
    fi
    sync_worktrees_for_all_remote_branches "$dest" "$namespace" "$primary"
    record_outcome UPDATED "$namespace"
    echo "          altre worktree: ${TARGET_DIR}/${namespace}.__wt__/"
  else
    echo "  [clone]  $namespace — modalità worktree (tutti i branch)"
    if ! git clone "$clone_url" "$dest" &>/dev/null; then
      echo "  [WARN]  clone fallito: $namespace"
      register_skip "$namespace" "clone fallito (worktree)"
      return
    fi
    git -C "$dest" fetch origin --prune &>/dev/null || true
    local primary
    primary=$(pick_priority_branch "$dest") || {
      echo "  [SKIP]  clone ok ma nessun branch ${BRANCH_PRIORITY[*]}: $namespace"
      register_skip "$namespace" "clone ok ma nessun branch in priorità (worktree)"
      return
    }
    echo "          directory principale (priority): $primary"
    if ! git -C "$dest" checkout "$primary" &>/dev/null; then
      echo "  [WARN]  checkout fallito dopo clone: $namespace ($primary)"
      register_skip "$namespace" "checkout fallito dopo clone: $primary (worktree)"
      return
    fi
    sync_worktrees_for_all_remote_branches "$dest" "$namespace" "$primary"
    record_outcome NEW "$namespace"
    echo "          altre worktree: ${TARGET_DIR}/${namespace}.__wt__/"
  fi
}

clone_or_pull() {
  local clone_url="$1"
  local namespace="$2"
  local dest="${TARGET_DIR}/${namespace}"

  if is_worktrees_repo "$namespace"; then
    clone_or_pull_worktrees_all "$clone_url" "$namespace"
    return
  fi

  mkdir -p "$(dirname "$dest")"

  if [[ -d "${dest}/.git" ]]; then
    echo "  [update] $namespace — repo già presente, sincronizzo con origin"
    git -C "$dest" remote set-head origin -a 2>/dev/null || true
    if ! git -C "$dest" fetch origin 2>/dev/null; then
      echo "  [WARN]  fetch fallito: $namespace"
      register_skip "$namespace" "fetch origin fallito"
      return
    fi
    local branch
    branch=$(pick_priority_branch "$dest") || {
      echo "  [SKIP]  nessun branch tra ${BRANCH_PRIORITY[*]} su origin: $namespace"
      register_skip "$namespace" "nessun branch in priorità su origin"
      return
    }
    echo "          branch scelta: $branch"
    if ! git -C "$dest" checkout "$branch" 2>/dev/null; then
      echo "  [WARN]  checkout fallito: $namespace ($branch)"
      register_skip "$namespace" "checkout fallito: ${branch}"
      return
    fi
    if git -C "$dest" pull origin "$branch" --ff-only &>/dev/null; then
      record_outcome UPDATED "$namespace"
      echo "          pull completato (ff-only)."
    else
      echo "  [WARN]  pull --ff-only fallito: $namespace"
      register_skip "$namespace" "pull --ff-only fallito su ${branch}"
    fi
  else
    echo "  [clone]  $namespace — checkout da zero"
    if ! git clone "$clone_url" "$dest" &>/dev/null; then
      echo "  [WARN]  clone fallito: $namespace"
      register_skip "$namespace" "clone fallito"
      return
    fi
    local branch
    branch=$(pick_priority_branch "$dest") || {
      echo "  [SKIP]  clone ok ma nessun branch ${BRANCH_PRIORITY[*]}: $namespace"
      register_skip "$namespace" "clone ok ma nessun branch in priorità"
      return
    }
    echo "          branch scelta: $branch"
    if ! git -C "$dest" checkout "$branch" &>/dev/null; then
      echo "  [WARN]  checkout fallito dopo clone: $namespace ($branch)"
      register_skip "$namespace" "checkout fallito dopo clone: ${branch}"
      return
    fi
    record_outcome NEW "$namespace"
    echo "          clone e checkout completati."
  fi
}

# ── Main ──────────────────────────────────────────────────

NEW=0
UPDATED=0
SKIPPED=0
SKIPPED_DETAIL=()
RUN_START=$SECONDS

if [[ "$SKIP_GROUP_LIST" -eq 1 ]]; then
  echo "(Elenco gruppi GitLab saltato: --skip-group-list)"
  echo ""
else
  list_accessible_groups
fi

PROJECTS_FILE=$(mktemp)

for GROUP_PATH in "${GROUP_PATHS[@]}"; do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Gruppo: $GROUP_PATH"

  GROUP_ID=$(get_group_id "$GROUP_PATH") || {
    echo "  [WARN] Gruppo non trovato o non accessibile: $GROUP_PATH"
    continue
  }
  echo "Group ID: $GROUP_ID"

  fetch_projects "$GROUP_ID" >> "$PROJECTS_FILE"
done

DEDUP_FILE=$(mktemp)
sort -u "$PROJECTS_FILE" > "$DEDUP_FILE"
rm -f "$PROJECTS_FILE"

TOTAL=$(wc -l < "$DEDUP_FILE" | tr -d ' ')
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Trovati ${TOTAL} progetti totali (deduplicati)."
echo ""

if [[ "$PARALLEL_JOBS" -le 1 ]]; then
  unset OUTCOME_PART_DIR
  while IFS=$'\t' read -r clone_url namespace; do
    [[ -z "$clone_url" ]] && continue
    clone_or_pull "$clone_url" "$namespace"
  done < "$DEDUP_FILE"
else
  echo "Esecuzione parallela (--jobs=${PARALLEL_JOBS}); i log per repo possono apparire intercalati."
  echo "Gli esiti (nuovi / aggiornati / saltati) sono comunque aggregati sotto."
  echo ""
  OUTCOME_PART_DIR=$(mktemp -d "${TMPDIR:-/tmp}/clone-all-out.XXXXXX")
  export OUTCOME_PART_DIR
  running=0
  while IFS=$'\t' read -r clone_url namespace; do
    [[ -z "$clone_url" ]] && continue
    clone_or_pull "$clone_url" "$namespace" &
    running=$((running + 1))
    if (( running >= PARALLEL_JOBS )); then
      wait
      running=0
    fi
  done < "$DEDUP_FILE"
  wait
  aggregate_outcome_parts "$OUTCOME_PART_DIR"
  unset OUTCOME_PART_DIR
fi

rm -f "$DEDUP_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Riepilogo"
echo "  • Repo totali (elaborati):     ${TOTAL}"
echo "  • Nuovi (clone + branch):      ${NEW}"
echo "  • Aggiornati (fetch + pull):   ${UPDATED}"
if [[ "${SKIPPED}" -gt 0 ]]; then
  echo "  • Saltati / errori:            ${SKIPPED}"
  echo ""
  echo "  Dettaglio saltati / errori:"
  for line in "${SKIPPED_DETAIL[@]}"; do
    printf '    - %s\n      %s\n' "${line%%$'\t'*}" "${line#*$'\t'}"
  done
fi

elapsed_sec=$((SECONDS - RUN_START))
if (( elapsed_sec >= 3600 )); then
  ELAPSED_FMT="$((elapsed_sec / 3600))h $(((elapsed_sec % 3600) / 60))m $((elapsed_sec % 60))s"
elif (( elapsed_sec >= 60 )); then
  ELAPSED_FMT="$((elapsed_sec / 60))m $((elapsed_sec % 60))s"
else
  ELAPSED_FMT="${elapsed_sec}s"
fi
echo "  • Tempo di esecuzione:          ${ELAPSED_FMT}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Directory radice: $TARGET_DIR"
