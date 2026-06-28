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
RELEASE_BUILD_DIR=""
KEEP_RELEASE_WORKSPACE=0

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

unit_file_name() {
  printf '%s.service' "$1"
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
  echo "Nasazení poběží v ${REPO_DIR} a restartuje služby $(unit_file_name "${WEB_UNIT_NAME}")/$(unit_file_name "${WORKER_UNIT_NAME}")."
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

load_runtime_env() {
  if [[ ! -f "${REPO_DIR}/.env" ]]; then
    echo "Nenašel jsem ${REPO_DIR}/.env. Release skript potřebuje produkční env soubor." >&2
    exit 1
  fi

  local line
  local line_number=0
  local key
  local raw_value
  local value

  while IFS= read -r line || [[ -n "${line}" ]]; do
    line_number=$((line_number + 1))
    line="${line%$'\r'}"

    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "${line}" =~ ^[[:space:]]*# ]] && continue

    if [[ ! "${line}" =~ ^[[:space:]]*([A-Za-z_][A-Za-z0-9_]*)[[:space:]]*=(.*)$ ]]; then
      echo ".env obsahuje nevalidní řádek ${line_number}: ${line}" >&2
      echo "Release skript podporuje dotenv zápis KEY=VALUE, ne shellové příkazy." >&2
      exit 1
    fi

    key="${BASH_REMATCH[1]}"
    raw_value="${BASH_REMATCH[2]}"
    raw_value="${raw_value#"${raw_value%%[![:space:]]*}"}"
    value="${raw_value}"

    if [[ "${value}" =~ ^\"(.*)\"[[:space:]]*$ ]]; then
      value="${BASH_REMATCH[1]}"
      value="${value//\\n/$'\n'}"
      value="${value//\\r/$'\r'}"
      value="${value//\\t/$'\t'}"
      value="${value//\\\"/\"}"
      value="${value//\\\\/\\}"
    elif [[ "${value}" =~ ^\'(.*)\'[[:space:]]*$ ]]; then
      value="${BASH_REMATCH[1]}"
    else
      value="${value%"${value##*[![:space:]]}"}"
      if [[ "${value}" =~ ^(.*[^[:space:]])[[:space:]]+#.*$ ]]; then
        value="${BASH_REMATCH[1]}"
      fi
    fi

    export "${key}=${value}"
  done < "${REPO_DIR}/.env"
}

validate_server_actions_encryption_key() {
  if [[ -z "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}" ]]; then
    echo "V .env chybí NEXT_SERVER_ACTIONS_ENCRYPTION_KEY." >&2
    echo "Bez stabilního klíče hrozí po deployi chyby 'Failed to find Server Action'." >&2
    exit 1
  fi

  if ! node <<'NODE'
const key = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY;

if (!key) {
  process.exit(1);
}

try {
  const decoded = Buffer.from(key, "base64");
  if (![16, 24, 32].includes(decoded.length)) {
    process.exit(1);
  }
} catch {
  process.exit(1);
}
NODE
  then
    echo "NEXT_SERVER_ACTIONS_ENCRYPTION_KEY není validní base64 AES klíč délky 16, 24 nebo 32 bajtů." >&2
    echo "Doporučení: vygeneruj nový přes 'openssl rand -base64 32' a ulož ho do .env." >&2
    exit 1
  fi
}

prepare_deployment_env() {
  local release_git_hash

  release_git_hash="$(git rev-parse --short=12 HEAD)"
  export NEXT_DEPLOYMENT_ID="${release_git_hash}"
  export DEPLOYMENT_VERSION="${release_git_hash}"
  export GIT_HASH="${release_git_hash}"

  log "NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}"
}

create_release_workspace() {
  local release_parent_dir

  release_parent_dir="$(dirname "${REPO_DIR}")"
  RELEASE_BUILD_DIR="$(mktemp -d -p "${release_parent_dir}" ".ppstudio-release.XXXXXX")"

  log "Připravuji izolovaný build workspace ${RELEASE_BUILD_DIR}"
  git -C "${REPO_DIR}" archive --format=tar HEAD | tar -xf - -C "${RELEASE_BUILD_DIR}"
  cp "${REPO_DIR}/.env" "${RELEASE_BUILD_DIR}/.env"
}

cleanup_release_workspace() {
  if [[ "${KEEP_RELEASE_WORKSPACE}" -eq 1 ]]; then
    return
  fi

  if [[ -n "${RELEASE_BUILD_DIR}" && -d "${RELEASE_BUILD_DIR}" ]]; then
    rm -rf "${RELEASE_BUILD_DIR}"
  fi
}

swap_release_artifacts() {
  local previous_node_modules_dir="${REPO_DIR}/node_modules.previous-release"
  local previous_next_dir="${REPO_DIR}/.next.previous-release"

  if [[ ! -d "${RELEASE_BUILD_DIR}/node_modules" ]] || [[ ! -d "${RELEASE_BUILD_DIR}/.next" ]]; then
    echo "Staging workspace neobsahuje hotové node_modules/.next artefakty, přepnutí releasu ruším." >&2
    exit 1
  fi

  rm -rf "${previous_node_modules_dir}" "${previous_next_dir}"

  log "stop ${WEB_UNIT_NAME}/${WORKER_UNIT_NAME}"
  sudo systemctl stop "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}"

  if [[ -d "${REPO_DIR}/node_modules" ]]; then
    mv "${REPO_DIR}/node_modules" "${previous_node_modules_dir}"
  fi

  if [[ -d "${REPO_DIR}/.next" ]]; then
    mv "${REPO_DIR}/.next" "${previous_next_dir}"
  fi

  mv "${RELEASE_BUILD_DIR}/node_modules" "${REPO_DIR}/node_modules"
  mv "${RELEASE_BUILD_DIR}/.next" "${REPO_DIR}/.next"

  if sudo systemctl start "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}"; then
    rm -rf "${previous_node_modules_dir}" "${previous_next_dir}"
    return
  fi

  echo "Start nového releasu selhal, vracím předchozí build artefakty." >&2
  KEEP_RELEASE_WORKSPACE=1

  sudo systemctl stop "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}" >/dev/null 2>&1 || true
  rm -rf "${REPO_DIR}/node_modules" "${REPO_DIR}/.next"

  if [[ -d "${previous_node_modules_dir}" ]]; then
    mv "${previous_node_modules_dir}" "${REPO_DIR}/node_modules"
  fi

  if [[ -d "${previous_next_dir}" ]]; then
    mv "${previous_next_dir}" "${REPO_DIR}/.next"
  fi

  sudo systemctl start "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}" >/dev/null 2>&1 || true

  echo "Rollback hotový. Zkontroluj journalctl a build workspace ${RELEASE_BUILD_DIR}." >&2
  exit 1
}

ensure_unit_installed() {
  local unit_name="$1"
  local unit_file
  local load_state

  unit_file="$(unit_file_name "${unit_name}")"
  load_state="$(systemctl show -p LoadState --value "${unit_file}" 2>/dev/null || true)"

  if [[ "${load_state}" == "loaded" ]]; then
    return
  fi

  echo "Systemd unit ${unit_file} není na serveru nainstalovaná (LoadState=${load_state:-unknown})." >&2
  echo "Nejdřív spusť jednorázovou instalaci unitů:" >&2
  echo "  sudo ${REPO_DIR}/deploy/deploy.sh" >&2
  exit 1
}

ensure_no_pm2_conflicts() {
  local pm2_list

  if ! command -v pm2 >/dev/null 2>&1; then
    return
  fi

  pm2_list="$(pm2 jlist 2>/dev/null || true)"
  if [[ "${pm2_list}" != *"\"name\":\"${WEB_UNIT_NAME}\""* ]] && [[ "${pm2_list}" != *"\"name\":\"${WORKER_UNIT_NAME}\""* ]]; then
    return
  fi

  echo "Na serveru pořád běží legacy PM2 procesy ${WEB_UNIT_NAME}/${WORKER_UNIT_NAME}, které kolidují se systemd rolloutem." >&2
  echo "Nejdřív převeď provoz jen na systemd:" >&2
  echo "  pm2 delete ${WEB_UNIT_NAME} ${WORKER_UNIT_NAME}" >&2
  echo "  pm2 save --force" >&2
  echo "  systemctl disable --now pm2-root.service" >&2
  exit 1
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
  require_cmd tar
  require_cmd mktemp
  require_cmd node
  require_cmd npm
  require_cmd npx
  require_cmd systemctl

  if [[ ! -f "${REPO_DIR}/package.json" ]]; then
    echo "Nenašel jsem package.json v ${REPO_DIR}." >&2
    exit 1
  fi

  load_runtime_env
  validate_server_actions_encryption_key

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

  ensure_unit_installed "${WEB_UNIT_NAME}"
  ensure_unit_installed "${WORKER_UNIT_NAME}"
  ensure_no_pm2_conflicts

  confirm_or_exit
  check_root_permissions_hint

  if [[ "${SKIP_PULL}" -ne 1 ]]; then
    log "git pull --ff-only"
    git pull --ff-only
  else
    log "Přeskakuji git pull (--skip-pull)."
  fi

  prepare_deployment_env

  trap cleanup_release_workspace EXIT
  create_release_workspace

  cd "${RELEASE_BUILD_DIR}"

  log "npm ci --include=dev"
  npm ci --include=dev

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

  cd "${REPO_DIR}"
  swap_release_artifacts

  log "status ${WEB_UNIT_NAME}"
  systemctl --no-pager --lines=20 status "${WEB_UNIT_NAME}"

  log "status ${WORKER_UNIT_NAME}"
  systemctl --no-pager --lines=20 status "${WORKER_UNIT_NAME}"

  log "Hotovo. Doporučení: proveď ruční smoke test veřejného webu + adminu."
}

parse_args "$@"
run_release
