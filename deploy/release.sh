#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="${PPSTUDIO_REPO_DIR:-$(cd "${SCRIPT_DIR}/.." && pwd)}"
SYSTEMD_DIR="${PPSTUDIO_SYSTEMD_DIR:-/etc/systemd/system}"
RELEASES_DIR="${PPSTUDIO_RELEASES_DIR:-${REPO_DIR}/releases}"
CURRENT_RELEASE_LINK="${REPO_DIR}/current"
PREVIOUS_RELEASE_LINK="${REPO_DIR}/previous"
WEB_UNIT_NAME="ppstudio-web"
WORKER_UNIT_NAME="ppstudio-email-worker"
RUNTIME_RELEASE_ENV_FILE=".release-env"
HEALTH_URL="${PPSTUDIO_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
SMOKE_URL="${PPSTUDIO_SMOKE_URL:-http://127.0.0.1:3000/}"
HEALTH_RETRIES="${PPSTUDIO_HEALTH_RETRIES:-15}"
HEALTH_RETRY_SECONDS="${PPSTUDIO_HEALTH_RETRY_SECONDS:-2}"
WEB_READY_RETRIES="${PPSTUDIO_WEB_READY_RETRIES:-20}"
WEB_READY_RETRY_SECONDS="${PPSTUDIO_WEB_READY_RETRY_SECONDS:-0.25}"
RETAIN_RELEASES="${PPSTUDIO_RETAIN_RELEASES:-4}"

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
  --keep-releases N  Ponechat N posledních dalších release (výchozí: 7)
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

install_unit_file() {
  local unit_name="$1"
  local source_file="${REPO_DIR}/deploy/systemd/$(unit_file_name "${unit_name}")"
  local target_file="${SYSTEMD_DIR}/$(unit_file_name "${unit_name}")"

  if [[ ! -f "${source_file}" ]]; then
    echo "Chybí unit šablona ${source_file}." >&2
    exit 1
  fi

  sudo install -m 0644 "${source_file}" "${target_file}"
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

check_local_migration_directories() {
  local migration_dir migration_name tracked_path invalid=0
  while IFS= read -r migration_dir; do
    migration_name="$(basename "${migration_dir}")"
    if [[ ! -f "${migration_dir}/migration.sql" ]]; then
      tracked_path="$(git -C "${REPO_DIR}" ls-tree -d --name-only HEAD -- "prisma/migrations/${migration_name}")"
      if [[ -n "${tracked_path}" ]]; then
        echo "Migrace ${migration_name} je sledovaná, ale chybí ${migration_dir}/migration.sql." >&2
      else
        echo "Lokální migrační adresář ${migration_name} není v HEAD a chybí v něm migration.sql." >&2
      fi
      invalid=1
    fi
  done < <(find "${REPO_DIR}/prisma/migrations" -mindepth 1 -maxdepth 1 -type d -print | sort)
  if [[ "${invalid}" -ne 0 ]]; then
    echo "Release zastaven: Prisma migrate deploy by skončil chybou P3015." >&2
    exit 1
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

write_runtime_release_env_file() {
  local target_file="$1"

  cat > "${target_file}" <<EOF
NEXT_DEPLOYMENT_ID=${NEXT_DEPLOYMENT_ID}
DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION}
GIT_HASH=${GIT_HASH}
EOF
}

create_release_workspace() {
  mkdir -p "${RELEASES_DIR}"
  RELEASE_BUILD_DIR="$(mktemp -d -p "${RELEASES_DIR}" ".staging.XXXXXX")"

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

cleanup_old_releases() {
  local current_target=""
  local previous_target=""
  local release_dir
  local additional_kept=0

  if ! [[ "${RETAIN_RELEASES}" =~ ^[0-9]+$ ]]; then
    echo "--keep-releases musí být nezáporné celé číslo." >&2
    return 1
  fi

  [[ -L "${CURRENT_RELEASE_LINK}" ]] && current_target="$(readlink -f "${CURRENT_RELEASE_LINK}")"
  [[ -L "${PREVIOUS_RELEASE_LINK}" ]] && previous_target="$(readlink -f "${PREVIOUS_RELEASE_LINK}")"

  while IFS= read -r -d '' release_dir; do
    case "$(basename "${release_dir}")" in
      [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
      *) continue ;;
    esac

    if [[ "${release_dir}" == "${current_target}" || "${release_dir}" == "${previous_target}" ]]; then
      continue
    fi

    if (( additional_kept < RETAIN_RELEASES )); then
      additional_kept=$((additional_kept + 1))
      continue
    fi

    log "Mažu starý release ${release_dir}"
    rm -rf -- "${release_dir}"
  done < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z -r)
}

set_release_link() {
  local link_path="$1"
  local target_path="$2"
  local temporary_link="${link_path}.new"

  ln -sfn "${target_path}" "${temporary_link}"
  mv -Tf "${temporary_link}" "${link_path}"
}

start_release_services() {
  sudo systemctl start "${WEB_UNIT_NAME}" || return 1
  sudo systemctl start "${WORKER_UNIT_NAME}" || return 1
}

wait_for_web_listener() {
  local attempt

  for ((attempt = 1; attempt <= WEB_READY_RETRIES; attempt++)); do
    # Po systemctl start Next.js ještě krátce neotevře port. Tento tichý probe
    # rozlišuje očekávaný start od skutečného selhání health/smoke kontroly.
    if curl --silent --output /dev/null --max-time 1 "${HEALTH_URL}"; then
      return 0
    fi

    sleep "${WEB_READY_RETRY_SECONDS}"
  done

  log "Web po startu nezačal naslouchat (${HEALTH_URL}) ani po ${WEB_READY_RETRIES} pokusech."
  return 1
}

release_is_healthy() {
  local response_file smoke_response_file http_status
  response_file="$(mktemp)"
  smoke_response_file="$(mktemp)"

  if ! sudo systemctl is-active --quiet "${WEB_UNIT_NAME}" || ! sudo systemctl is-active --quiet "${WORKER_UNIT_NAME}"; then
    log "Health/smoke kontrola: web nebo e-mailový worker neběží."
    rm -f "${response_file}" "${smoke_response_file}"
    return 1
  fi

  if ! http_status="$(curl --silent --show-error --max-time 10 --output "${response_file}" --write-out '%{http_code}' "${HEALTH_URL}")"; then
    log "Health endpoint není dostupný (${HEALTH_URL})."
    rm -f "${response_file}" "${smoke_response_file}"
    return 1
  fi

  if [[ ! "${http_status}" =~ ^2[0-9][0-9]$ ]]; then
    log "Health endpoint vrátil HTTP ${http_status} (${HEALTH_URL})."
    rm -f "${response_file}" "${smoke_response_file}"
    return 1
  fi

  if ! node -e '
const fs = require("node:fs");
const health = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (health.release?.deploymentId !== process.env.NEXT_DEPLOYMENT_ID) process.exit(1);
' "${response_file}"; then
    log "Health endpoint nemá očekávané deployment ID."
    rm -f "${response_file}" "${smoke_response_file}"
    return 1
  fi

  rm -f "${response_file}"

  if ! http_status="$(curl --silent --show-error --max-time 10 --output "${smoke_response_file}" --write-out '%{http_code}' "${SMOKE_URL}")"; then
    log "Homepage smoke test není dostupný (${SMOKE_URL})."
    rm -f "${smoke_response_file}"
    return 1
  fi

  rm -f "${smoke_response_file}"

  if [[ ! "${http_status}" =~ ^2[0-9][0-9]$ ]]; then
    log "Homepage smoke test vrátil HTTP ${http_status} (${SMOKE_URL})."
    return 1
  fi
}

wait_for_release_health() {
  local attempt
  for ((attempt = 1; attempt <= HEALTH_RETRIES; attempt++)); do
    if release_is_healthy; then
      return 0
    fi

    log "Health/smoke test zatím neprošel (${attempt}/${HEALTH_RETRIES})."
    sleep "${HEALTH_RETRY_SECONDS}"
  done
  return 1
}

rollback_release() {
  local previous_target="$1"

  echo "Nový release neprošel startem nebo health/smoke testem, vracím předchozí celý release." >&2
  sudo systemctl stop "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}" >/dev/null 2>&1 || true

  if [[ -n "${previous_target}" ]]; then
    set_release_link "${CURRENT_RELEASE_LINK}" "${previous_target}"
    sudo systemctl start "${WEB_UNIT_NAME}" >/dev/null 2>&1 || true
    sudo systemctl start "${WORKER_UNIT_NAME}" >/dev/null 2>&1 || true
  else
    rm -f "${CURRENT_RELEASE_LINK}"
  fi

  echo "Rollback hotový; databázové migrace se záměrně nevracejí automaticky. Zkontroluj kompatibilitu schématu a journalctl." >&2
  return 1
}

activate_release() {
  local release_dir="$1"
  local previous_target=""

  if [[ ! -d "${release_dir}/node_modules" ]] || [[ ! -d "${release_dir}/.next" ]] || [[ ! -f "${release_dir}/package.json" ]]; then
    echo "Release ${release_dir} není kompletní (chybí zdrojové soubory, node_modules nebo .next)." >&2
    return 1
  fi

  if [[ -L "${CURRENT_RELEASE_LINK}" ]]; then
    previous_target="$(readlink -f "${CURRENT_RELEASE_LINK}")"
  elif [[ -e "${CURRENT_RELEASE_LINK}" ]]; then
    echo "${CURRENT_RELEASE_LINK} musí být symlink na aktivní release." >&2
    return 1
  fi

  log "stop ${WEB_UNIT_NAME}/${WORKER_UNIT_NAME}"
  sudo systemctl stop "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}"
  set_release_link "${CURRENT_RELEASE_LINK}" "${release_dir}"

  if start_release_services && wait_for_web_listener && wait_for_release_health; then
    if [[ -n "${previous_target}" ]]; then
      set_release_link "${PREVIOUS_RELEASE_LINK}" "${previous_target}"
    fi
    return 0
  fi

  rollback_release "${previous_target}"
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

sync_systemd_units() {
  log "synchronizuji systemd unity z deploy/systemd"
  install_unit_file "${WEB_UNIT_NAME}"
  install_unit_file "${WORKER_UNIT_NAME}"

  log "systemctl daemon-reload"
  sudo systemctl daemon-reload
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
      --keep-releases)
        RETAIN_RELEASES="$2"
        shift 2
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
  require_cmd curl

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

  sync_systemd_units

  check_local_migration_directories

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

  log "npx prisma validate (bez zápisu do DB)"
  npx prisma validate

  if [[ "${SKIP_LINT}" -ne 1 ]]; then
    log "npm run lint"
    npm run lint
  else
    log "Přeskakuji lint (--skip-lint)."
  fi

  log "npm run typecheck"
  npm run typecheck

  log "npm run build"
  npm run build

  write_runtime_release_env_file "${RELEASE_BUILD_DIR}/${RUNTIME_RELEASE_ENV_FILE}"

  local release_name
  local release_dir
  release_name="${GIT_HASH}-$(date -u +%Y%m%d%H%M%S)"
  release_dir="${RELEASES_DIR}/${release_name}"
  mv "${RELEASE_BUILD_DIR}" "${release_dir}"
  RELEASE_BUILD_DIR=""

  cd "${release_dir}"
  log "npx prisma migrate deploy (těsně před aktivací; pouze expand/contract migrace)"
  npx prisma migrate deploy

  cd "${REPO_DIR}"
  activate_release "${release_dir}"
  cleanup_old_releases

  log "status ${WEB_UNIT_NAME}"
  systemctl --no-pager --lines=20 status "${WEB_UNIT_NAME}"

  log "status ${WORKER_UNIT_NAME}"
  systemctl --no-pager --lines=20 status "${WORKER_UNIT_NAME}"

  log "Hotovo. Doporučení: proveď ruční smoke test veřejného webu + adminu."
}

main() {
  parse_args "$@"
  run_release
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
