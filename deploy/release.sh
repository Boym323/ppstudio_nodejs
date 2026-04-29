#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WEB_UNIT_NAME="ppstudio-web"
WORKER_UNIT_NAME="ppstudio-email-worker"

ALLOW_DIRTY=0
SKIP_PULL=0
SKIP_LINT=0
SKIP_CONFIRM=0
BRANCH="main"

usage() {
  cat <<'USAGE'
Použití: ./deploy/release.sh [volby]

Volby:
  --branch <name>    Očekávaná release větev (výchozí: main)
  --allow-dirty      Povolit release i s necommitnutými změnami
  --skip-pull        Přeskočit 'git pull --ff-only'
  --skip-lint        Přeskočit 'npm run lint'
  --yes              Přeskočit interaktivní potvrzení
  -h, --help         Zobrazit nápovědu
USAGE
}

log() {
  printf '[release] %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Chybí požadovaný příkaz: $1" >&2
    exit 1
  fi
}

confirm_or_exit() {
  if [[ "${SKIP_CONFIRM}" -eq 1 ]]; then
    return
  fi

  echo
  echo "Nasazení poběží v ${REPO_DIR} a restartuje služby ${WEB_UNIT_NAME}/${WORKER_UNIT_NAME}."
  read -r -p "Pokračovat? [yes/N]: " response
  if [[ "${response}" != "yes" ]]; then
    echo "Nasazení zrušeno."
    exit 1
  fi
}

check_root_permissions_hint() {
  if ! sudo -n true >/dev/null 2>&1; then
    echo "Poznámka: restart služeb bude vyžadovat sudo heslo." >&2
  fi
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --branch)
        BRANCH="$2"
        shift 2
        ;;
      --allow-dirty)
        ALLOW_DIRTY=1
        shift
        ;;
      --skip-pull)
        SKIP_PULL=1
        shift
        ;;
      --skip-lint)
        SKIP_LINT=1
        shift
        ;;
      --yes)
        SKIP_CONFIRM=1
        shift
        ;;
      -h|--help)
        usage
        exit 0
        ;;
      *)
        echo "Neznámá volba: $1" >&2
        usage
        exit 1
        ;;
    esac
  done
}

run_release() {
  cd "${REPO_DIR}"

  require_cmd git
  require_cmd npm
  require_cmd npx
  require_cmd systemctl

  if [[ ! -f "${REPO_DIR}/package.json" ]]; then
    echo "Nenašel jsem package.json v ${REPO_DIR}." >&2
    exit 1
  fi

  local current_branch
  current_branch="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${current_branch}" != "${BRANCH}" ]]; then
    echo "Aktuální větev je '${current_branch}', očekávám '${BRANCH}'." >&2
    echo "Použij --branch ${current_branch}, pokud je to záměr." >&2
    exit 1
  fi

  if [[ "${ALLOW_DIRTY}" -ne 1 ]] && [[ -n "$(git status --porcelain)" ]]; then
    echo "Working tree není čistý. Commitni změny, nebo použij --allow-dirty." >&2
    exit 1
  fi

  confirm_or_exit
  check_root_permissions_hint

  if [[ "${SKIP_PULL}" -ne 1 ]]; then
    log "git pull --ff-only"
    git pull --ff-only
  else
    log "Přeskakuji git pull (--skip-pull)."
  fi

  log "npm ci"
  npm ci

  log "npm run db:generate"
  npm run db:generate

  log "npm run db:check-migrations"
  npm run db:check-migrations

  log "npx prisma migrate deploy"
  npx prisma migrate deploy

  if [[ "${SKIP_LINT}" -ne 1 ]]; then
    log "npm run lint"
    npm run lint
  else
    log "Přeskakuji lint (--skip-lint)."
  fi

  log "npm run build"
  npm run build

  log "restart ${WEB_UNIT_NAME}"
  sudo systemctl restart "${WEB_UNIT_NAME}"

  log "restart ${WORKER_UNIT_NAME}"
  sudo systemctl restart "${WORKER_UNIT_NAME}"

  log "status ${WEB_UNIT_NAME}"
  systemctl --no-pager --lines=20 status "${WEB_UNIT_NAME}"

  log "status ${WORKER_UNIT_NAME}"
  systemctl --no-pager --lines=20 status "${WORKER_UNIT_NAME}"

  log "Hotovo. Doporučení: proveď ruční smoke test veřejného webu + adminu."
}

parse_args "$@"
run_release
