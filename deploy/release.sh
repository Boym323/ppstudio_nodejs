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
SYSUSERS_FILE="ppstudio.sysusers.conf"
TMPFILES_FILE="ppstudio.tmpfiles.conf"
RUNTIME_USER="ppstudio"
RUNTIME_GROUP="ppstudio"
RUNTIME_RELEASE_ENV_FILE=".release-env"
HEALTH_URL="${PPSTUDIO_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
SMOKE_URL="${PPSTUDIO_SMOKE_URL:-http://127.0.0.1:3000/}"
HEALTH_RETRIES="${PPSTUDIO_HEALTH_RETRIES:-15}"
HEALTH_RETRY_SECONDS="${PPSTUDIO_HEALTH_RETRY_SECONDS:-2}"
WEB_READY_RETRIES="${PPSTUDIO_WEB_READY_RETRIES:-20}"
WEB_READY_RETRY_SECONDS="${PPSTUDIO_WEB_READY_RETRY_SECONDS:-0.25}"
RETAIN_RELEASES="${PPSTUDIO_RETAIN_RELEASES:-0}"

SKIP_PULL=0
SKIP_LINT=0
SKIP_CONFIRM=0
BRANCH="main"
RELEASE_BUILD_DIR=""
KEEP_RELEASE_WORKSPACE=0
RELEASE_STARTED_AT=""
RELEASE_STEP_DURATIONS=()

usage() {
  cat <<'USAGE'
Použití: ./deploy/release.sh [volby]

Volby:
  --branch <name>    Očekávaná release větev (výchozí: main)
  --skip-pull        Přeskočit 'git pull --ff-only'
  --skip-lint        Přeskočit 'npm run lint'
  --keep-releases N  Ponechat N posledních dalších release (výchozí: 0)
  --yes              Přeskočit interaktivní potvrzení
  -h, --help         Zobrazit nápovědu
USAGE
}

log() {
  printf '[release] %s\n' "$*"
}

log_release_duration() {
  local elapsed_seconds=$((SECONDS - RELEASE_STARTED_AT))
  local hours=$((elapsed_seconds / 3600))
  local minutes=$(((elapsed_seconds % 3600) / 60))
  local seconds=$((elapsed_seconds % 60))

  log "Celkový čas release od potvrzení: ${hours} h ${minutes} min ${seconds} s."
}

log_release_step_durations() {
  local duration

  log "Přehled časů kroků:"
  for duration in "${RELEASE_STEP_DURATIONS[@]}"; do
    log "  ${duration}"
  done
}

run_timed_step() {
  local step_name="$1"
  shift
  local started_at=${SECONDS}

  "$@"

  local elapsed_seconds=$((SECONDS - started_at))
  local hours=$((elapsed_seconds / 3600))
  local minutes=$(((elapsed_seconds % 3600) / 60))
  local seconds=$((elapsed_seconds % 60))

  RELEASE_STEP_DURATIONS+=("${step_name}: ${hours} h ${minutes} min ${seconds} s.")
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
    # Runtime uživatel může během provozu vytvořit .next/cache soubory a
    # adresáře, ke kterým deploy účet nemá právo traversalu. Cíl je už výše
    # omezený na release adresář mimo current/previous, proto je odstranění
    # přes sudo bezpečné a nezávislé na runtime vlastnictví cache.
    sudo rm -rf -- "${release_dir}"
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
  sudo install -m 0644 "${REPO_DIR}/deploy/systemd/${SYSUSERS_FILE}" "/etc/sysusers.d/${SYSUSERS_FILE}"
  sudo systemd-sysusers "/etc/sysusers.d/${SYSUSERS_FILE}"
  sudo install -m 0644 "${REPO_DIR}/deploy/systemd/${TMPFILES_FILE}" "/etc/tmpfiles.d/${TMPFILES_FILE}"
  sudo systemd-tmpfiles --create "/etc/tmpfiles.d/${TMPFILES_FILE}"
  install_unit_file "${WEB_UNIT_NAME}"
  install_unit_file "${WORKER_UNIT_NAME}"

  log "systemctl daemon-reload"
  sudo systemctl daemon-reload
}

validate_runtime_path() {
  local path_value="$1"
  local label="$2"
  local resolved_path

  resolved_path="$(readlink -m -- "${path_value}")" || {
    echo "${label} nelze normalizovat: ${path_value}." >&2
    return 1
  }

  if [[ "${resolved_path}" != /* || "${resolved_path}" == "/" || "${resolved_path}" == "/var" || "${resolved_path}" == "/var/www" ]]; then
    echo "${label} musí být bezpečná absolutní cesta, ne ${path_value}." >&2
    return 1
  fi
}

prepare_runtime_storage() {
  local media_root="${MEDIA_STORAGE_ROOT:-/var/www/ppstudio/uploads}"
  local snapshot_path="${SITE_SETTINGS_SNAPSHOT_PATH:-/var/lib/ppstudio/site-settings-snapshot.json}"
  local legacy_snapshot_path="${REPO_DIR}/site-settings-snapshot.json"
  local snapshot_dir
  local repo_path
  media_root="$(readlink -m -- "${media_root}")"
  snapshot_path="$(readlink -m -- "${snapshot_path}")"
  snapshot_dir="$(dirname "${snapshot_path}")"
  repo_path="$(readlink -m -- "${REPO_DIR}")"

  validate_runtime_path "${media_root}" "MEDIA_STORAGE_ROOT"
  validate_runtime_path "${snapshot_dir}" "Adresář SITE_SETTINGS_SNAPSHOT_PATH"
  if [[ "${media_root}" == "${repo_path}" || ( "${media_root}" == "${repo_path}"/* && "${media_root}" != "${repo_path}/uploads" ) ]]; then
    echo "MEDIA_STORAGE_ROOT nesmí mířit do checkoutu ${repo_path}; použij externí storage nebo ${repo_path}/uploads." >&2
    return 1
  fi
  if [[ "${snapshot_dir}" == "${repo_path}" || "${snapshot_dir}" == "${repo_path}"/* ]]; then
    echo "SITE_SETTINGS_SNAPSHOT_PATH nesmí ležet v checkoutu ${repo_path}; použij /var/lib/ppstudio/site-settings-snapshot.json." >&2
    return 1
  fi

  sudo install -d -o "${RUNTIME_USER}" -g "${RUNTIME_GROUP}" -m 0750 "${media_root}" "${snapshot_dir}"
  sudo chgrp "${RUNTIME_GROUP}" "${REPO_DIR}"
  sudo chmod g+rx "${REPO_DIR}"
  sudo chgrp "${RUNTIME_GROUP}" "${REPO_DIR}/.env"
  sudo chmod 0640 "${REPO_DIR}/.env"
  sudo chown -R "${RUNTIME_USER}:${RUNTIME_GROUP}" "${media_root}"
  sudo chmod -R u+rwX,g+rX,o-rwx "${media_root}"

  if [[ -z "${SITE_SETTINGS_SNAPSHOT_PATH:-}" && -f "${legacy_snapshot_path}" && ! -f "${snapshot_path}" ]]; then
    sudo install -o "${RUNTIME_USER}" -g "${RUNTIME_GROUP}" -m 0640 "${legacy_snapshot_path}" "${snapshot_path}"
  fi

  if [[ -f "${snapshot_path}" ]]; then
    sudo chown "${RUNTIME_USER}:${RUNTIME_GROUP}" "${snapshot_path}"
    sudo chmod 0640 "${snapshot_path}"
  fi
}

prepare_runtime_release() {
  local release_dir="$1"

  # Build zůstává ve vlastnictví deploy uživatele; runtime skupina dostane
  # read/traverse a Next.js cache navíc zápis pro zachování ISR/cache chování.
  sudo chgrp -R "${RUNTIME_GROUP}" "${release_dir}"
  sudo chmod -R g+rX,o-rwx "${release_dir}"
  if [[ -d "${release_dir}/.next/cache" ]]; then
    sudo chmod -R g+rwX "${release_dir}/.next/cache"
  fi
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
        echo "Volba --allow-dirty není podporovaná: release vyžaduje čistý working tree a artefakt vzniká pouze z HEAD." >&2
        exit 1
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

ensure_clean_worktree() {
  if [[ -n "$(git -C "${REPO_DIR}" status --porcelain)" ]]; then
    echo "Working tree není čistý. Commitni nebo odlož změny; release artefakt vždy vzniká pouze z HEAD." >&2
    return 1
  fi
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
  require_cmd systemd-sysusers
  require_cmd systemd-tmpfiles
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

  ensure_clean_worktree || exit 1

  ensure_unit_installed "${WEB_UNIT_NAME}"
  ensure_unit_installed "${WORKER_UNIT_NAME}"
  ensure_no_pm2_conflicts

  confirm_or_exit
  RELEASE_STARTED_AT=${SECONDS}
  check_root_permissions_hint

  if [[ "${SKIP_PULL}" -ne 1 ]]; then
    log "git pull --ff-only"
    run_timed_step "git pull" git pull --ff-only
  else
    log "Přeskakuji git pull (--skip-pull)."
  fi

  run_timed_step "synchronizace systemd unitů" sync_systemd_units
  run_timed_step "příprava runtime storage" prepare_runtime_storage
  if [[ -L "${CURRENT_RELEASE_LINK}" ]]; then
    run_timed_step "oprávnění aktivního release" prepare_runtime_release "$(readlink -f "${CURRENT_RELEASE_LINK}")"
  fi

  run_timed_step "kontrola lokálních migrací" check_local_migration_directories

  run_timed_step "příprava deployment environmentu" prepare_deployment_env

  trap cleanup_release_workspace EXIT
  run_timed_step "vytvoření staging workspace" create_release_workspace

  cd "${RELEASE_BUILD_DIR}"

  log "npm ci --include=dev"
  run_timed_step "npm ci" npm ci --include=dev

  log "npm run db:generate"
  run_timed_step "Prisma generate" npm run db:generate

  log "npm run db:check-migrations"
  run_timed_step "kontrola historie migrací" npm run db:check-migrations

  log "npx prisma validate (bez zápisu do DB)"
  run_timed_step "Prisma validate" npx prisma validate

  if [[ "${SKIP_LINT}" -ne 1 ]]; then
    log "npm run lint"
    run_timed_step "lint" npm run lint
  else
    log "Přeskakuji lint (--skip-lint)."
  fi

  log "npm run typecheck"
  run_timed_step "typecheck" npm run typecheck

  # Produkční .env nesmí spouštět zapisující DB integrační testy. Tento běh
  # ověřuje unit/regresní testy; DB integrační a E2E zůstávají CI bránou.
  log "npm run test:release (bez produkční DB)"
  run_timed_step "test:release" npm run test:release

  log "npm run build"
  run_timed_step "build" npm run build

  run_timed_step "zápis runtime release environmentu" write_runtime_release_env_file "${RELEASE_BUILD_DIR}/${RUNTIME_RELEASE_ENV_FILE}"

  local release_name
  local release_dir
  release_name="${GIT_HASH}-$(date -u +%Y%m%d%H%M%S)"
  release_dir="${RELEASES_DIR}/${release_name}"
  run_timed_step "finalizace release workspace" mv "${RELEASE_BUILD_DIR}" "${release_dir}"
  RELEASE_BUILD_DIR=""
  run_timed_step "runtime oprávnění release" prepare_runtime_release "${release_dir}"

  cd "${release_dir}"
  log "npx prisma migrate deploy (těsně před aktivací; pouze expand/contract migrace)"
  run_timed_step "Prisma migrate deploy" npx prisma migrate deploy

  cd "${REPO_DIR}"
  run_timed_step "aktivace release" activate_release "${release_dir}"
  run_timed_step "úklid starších releasů" cleanup_old_releases

  log "status ${WEB_UNIT_NAME}"
  run_timed_step "kontrola služby ${WEB_UNIT_NAME}" systemctl --no-pager --lines=20 status "${WEB_UNIT_NAME}"

  log "status ${WORKER_UNIT_NAME}"
  run_timed_step "kontrola služby ${WORKER_UNIT_NAME}" systemctl --no-pager --lines=20 status "${WORKER_UNIT_NAME}"

  log "Hotovo. Doporučení: proveď ruční smoke test veřejného webu + adminu."
  log_release_step_durations
  log_release_duration
}

main() {
  parse_args "$@"
  run_release
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
