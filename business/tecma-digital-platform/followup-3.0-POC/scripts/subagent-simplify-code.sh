#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GIT_TOP="$(cd "$ROOT_DIR" && git rev-parse --show-toplevel)"
if [[ "$ROOT_DIR" == "$GIT_TOP" ]]; then
  ROOT_FROM_TOP="."
else
  ROOT_FROM_TOP="${ROOT_DIR#"$GIT_TOP"/}"
fi
MODE="${1:-changed}"

log() {
  printf '[subagent:simplify] %s\n' "$*"
}

collect_changed_files() {
  (
    cd "$ROOT_DIR"
    git diff --name-only --diff-filter=ACMRTUXB
    git diff --name-only --cached --diff-filter=ACMRTUXB
  ) | awk '!seen[$0]++' | while IFS= read -r p; do
    if [[ "$ROOT_FROM_TOP" == "." ]]; then
      printf '%s\n' "$p"
    elif [[ "$p" == "$ROOT_FROM_TOP/"* ]]; then
      printf '%s\n' "${p#"$ROOT_FROM_TOP"/}"
    fi
  done
}

collect_all_files() {
  (
    cd "$ROOT_DIR"
    rg --files fe-followup-v3/src be-followup-v3/src
  )
}

run_fe_fix() {
  local files=("$@")
  if ((${#files[@]} == 0)); then
    log "FE: nessun file target"
    return 0
  fi

  log "FE: eslint --fix su ${#files[@]} file"
  (
    cd "$ROOT_DIR/fe-followup-v3"
    npx eslint --fix "${files[@]}"
  )
}

run_be_fix() {
  local files=("$@")
  if ((${#files[@]} == 0)); then
    log "BE: nessun file target"
    return 0
  fi

  log "BE: eslint --fix su ${#files[@]} file"
  (
    cd "$ROOT_DIR/be-followup-v3"
    npx eslint --fix "${files[@]}"
  )
}

TARGETS=""
if [[ "$MODE" == "changed" ]]; then
  TARGETS="$(collect_changed_files)"
elif [[ "$MODE" == "all" ]]; then
  TARGETS="$(collect_all_files)"
else
  printf 'Uso: %s [changed|all]\n' "$0" >&2
  exit 1
fi

FE_FILES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && FE_FILES+=("$line")
done < <(printf '%s\n' "$TARGETS" | rg '^fe-followup-v3/src/.+\.(ts|tsx|js|jsx)$' || true)

BE_FILES=()
while IFS= read -r line; do
  [[ -n "$line" ]] && BE_FILES+=("$line")
done < <(printf '%s\n' "$TARGETS" | rg '^be-followup-v3/src/.+\.(ts|tsx|js|jsx)$' || true)

FE_LOCAL=()
for f in "${FE_FILES[@]:-}"; do
  [[ -n "$f" ]] && FE_LOCAL+=("${f#fe-followup-v3/}")
done

BE_LOCAL=()
for f in "${BE_FILES[@]:-}"; do
  [[ -n "$f" ]] && BE_LOCAL+=("${f#be-followup-v3/}")
done

if ((${#FE_LOCAL[@]} > 0)); then
  run_fe_fix "${FE_LOCAL[@]}"
else
  run_fe_fix
fi

if ((${#BE_LOCAL[@]} > 0)); then
  run_be_fix "${BE_LOCAL[@]}"
else
  run_be_fix
fi

log "Verifiche finali"
if [[ "$MODE" == "all" ]]; then
  (
    cd "$ROOT_DIR"
    npm run -s test:lint
  )
  (
    cd "$ROOT_DIR/fe-followup-v3"
    npm run -s typecheck
  )
  (
    cd "$ROOT_DIR/be-followup-v3"
    npm run -s build
  )
else
  if ((${#FE_LOCAL[@]} > 0)); then
    (
      cd "$ROOT_DIR/fe-followup-v3"
      npx eslint "${FE_LOCAL[@]}"
      npm run -s typecheck
    )
  fi

  if ((${#BE_LOCAL[@]} > 0)); then
    (
      cd "$ROOT_DIR/be-followup-v3"
      npx eslint "${BE_LOCAL[@]}"
      npm run -s build
    )
  fi
fi

log "Completato"
