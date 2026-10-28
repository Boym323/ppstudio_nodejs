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
LIVENESS_URL="${PPSTUDIO_LIVENESS_URL:-http://127.0.0.1:3000/api/health/live}"
SMOKE_URL="${PPSTUDIO_SMOKE_URL:-http://127.0.0.1:3000/}"
HEALTH_RETRIES="${PPSTUDIO_HEALTH_RETRIES:-15}"
HEALTH_RETRY_SECONDS="${PPSTUDIO_HEALTH_RETRY_SECONDS:-2}"
WEB_READY_RETRIES="${PPSTUDIO_WEB_READY_RETRIES:-20}"
WEB_READY_RETRY_SECONDS="${PPSTUDIO_WEB_READY_RETRY_SECONDS:-0.25}"
RETAIN_RELEASES="${PPSTUDIO_RETAIN_RELEASES:-0}"
RELEASE_CGROUP_MODE="${PPSTUDIO_RELEASE_CGROUP_MODE:-required}"
RELEASE_CPU_QUOTA="${PPSTUDIO_RELEASE_CPU_QUOTA:-100%}"
RELEASE_CPU_WEIGHT="${PPSTUDIO_RELEASE_CPU_WEIGHT:-20}"
RELEASE_IO_WEIGHT="${PPSTUDIO_RELEASE_IO_WEIGHT:-20}"
RELEASE_MEMORY_HIGH="${PPSTUDIO_RELEASE_MEMORY_HIGH:-${RELEASE_MEMORY_HIGH:-}}"
RELEASE_MEMORY_MAX="${PPSTUDIO_RELEASE_MEMORY_MAX:-${RELEASE_MEMORY_MAX:-}}"
RELEASE_MEMORY_BUDGET_PERCENT="${PPSTUDIO_RELEASE_MEMORY_BUDGET_PERCENT:-60}"
RELEASE_MEMORY_HIGH_PERCENT="${PPSTUDIO_RELEASE_MEMORY_HIGH_PERCENT:-56}"
RELEASE_TASKS_MAX="${PPSTUDIO_RELEASE_TASKS_MAX:-512}"
RELEASE_NICE="${PPSTUDIO_RELEASE_NICE:-10}"

SKIP_PULL=0
SKIP_LINT=0
SKIP_CONFIRM=0
BRANCH="main"
RELEASE_BUILD_DIR=""
KEEP_RELEASE_WORKSPACE=0
RELEASE_WRITERS_STOPPED=0
RELEASE_STARTED_AT=""
SYSTEMD_BACKUP_DIR=""
SYSTEMD_UNITS_CHANGED=0
RELEASE_STEP_DURATIONS=()
RELEASE_CGROUP_SEQUENCE=0

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

release_detect_parent_memory_limit() {
  local hierarchy controllers cgroup_path cgroup_dir value minimum_limit=""

  [[ "$(stat -f -c %T /sys/fs/cgroup 2>/dev/null)" == "cgroup2fs" ]] || return 1
  cgroup_path=""
  while IFS=: read -r hierarchy controllers cgroup_path; do
    if [[ "${hierarchy}" == "0" && -z "${controllers}" ]]; then
      break
    fi
    cgroup_path=""
  done < /proc/self/cgroup
  [[ "${cgroup_path}" == /* && "${cgroup_path}" != *..* ]] || return 1

  cgroup_dir="/sys/fs/cgroup${cgroup_path}"
  while [[ "${cgroup_dir}" == /sys/fs/cgroup* ]]; do
    if [[ -r "${cgroup_dir}/memory.max" ]]; then
      value="$(<"${cgroup_dir}/memory.max")"
      if [[ "${value}" =~ ^[1-9][0-9]*$ ]]; then
        if [[ -z "${minimum_limit}" ]] || (( value < minimum_limit )); then
          minimum_limit="${value}"
        fi
      fi
    fi
    [[ "${cgroup_dir}" == "/sys/fs/cgroup" ]] && break
    cgroup_dir="${cgroup_dir%/*}"
  done
  [[ -n "${minimum_limit}" ]] || return 1
  printf '%s' "${minimum_limit}"
}

resolve_release_memory_limits() {
  # Povolení nechráněného DEV režimu ověří následná validace.
  [[ "${RELEASE_CGROUP_MODE}" != "off" ]] || return 0

  local configured_high="${RELEASE_MEMORY_HIGH:-${PPSTUDIO_RELEASE_MEMORY_HIGH:-}}"
  local configured_max="${RELEASE_MEMORY_MAX:-${PPSTUDIO_RELEASE_MEMORY_MAX:-}}"
  local budget_percent="${PPSTUDIO_RELEASE_MEMORY_BUDGET_PERCENT:-${RELEASE_MEMORY_BUDGET_PERCENT:-60}}"
  local high_percent="${PPSTUDIO_RELEASE_MEMORY_HIGH_PERCENT:-${RELEASE_MEMORY_HIGH_PERCENT:-56}}"
  local parent_limit derived_high derived_max

  if [[ -z "${configured_high}" || -z "${configured_max}" ]]; then
    if parent_limit="$(release_detect_parent_memory_limit)"; then
      [[ "${budget_percent}" =~ ^[1-9][0-9]?$|^100$ ]] || {
        echo "PPSTUDIO_RELEASE_MEMORY_BUDGET_PERCENT musí být 1–100." >&2
        return 1
      }
      [[ "${high_percent}" =~ ^[1-9][0-9]?$|^100$ ]] || {
        echo "PPSTUDIO_RELEASE_MEMORY_HIGH_PERCENT musí být 1–100." >&2
        return 1
      }
      (( high_percent <= budget_percent )) || {
        echo "PPSTUDIO_RELEASE_MEMORY_HIGH_PERCENT nesmí být vyšší než MEMORY_BUDGET_PERCENT." >&2
        return 1
      }
      derived_max=$((parent_limit * budget_percent / 100))
      derived_high=$((parent_limit * high_percent / 100))
      (( derived_high > 0 && derived_max > 0 )) || {
        echo "Nadřazený memory.max je příliš malý pro dynamický release rozpočet." >&2
        return 1
      }
      # systemd i numfmt přijímají absolutní počet bajtů bez přípony;
      # přípona "B" není pro numfmt validní.
      [[ -n "${configured_max}" ]] || configured_max="${derived_max}"
      [[ -n "${configured_high}" ]] || configured_high="${derived_high}"
      log "Dynamický release memory rozpočet: ${budget_percent}%/${high_percent}% z nejnižšího dostupného memory.max ${parent_limit} B."
    else
      echo "Konečný memory.max nebyl zjištěn; nastav explicitně PPSTUDIO_RELEASE_MEMORY_MAX a PPSTUDIO_RELEASE_MEMORY_HIGH podle paměťového rozpočtu hostitele." >&2
      return 1
    fi
  fi

  RELEASE_MEMORY_MAX="${configured_max}"
  RELEASE_MEMORY_HIGH="${configured_high}"
}

validate_release_resource_limits() {
  case "${RELEASE_CGROUP_MODE}" in
    required|off) ;;
    *)
      echo "PPSTUDIO_RELEASE_CGROUP_MODE musí být 'required' nebo 'off'." >&2
      return 1
      ;;
  esac

  if [[ "${RELEASE_CGROUP_MODE}" == "off" && "${PPSTUDIO_RELEASE_ALLOW_UNSCOPED:-0}" != "1" ]]; then
    echo "Nechráněný release preflight je zakázaný. Pro diagnostiku nastav PPSTUDIO_RELEASE_CGROUP_MODE=off PPSTUDIO_RELEASE_ALLOW_UNSCOPED=1." >&2
    return 1
  fi

  if [[ "${RELEASE_CGROUP_MODE}" == "off" ]]; then
    if [[ "${NODE_ENV:-}" == "production" ]]; then
      echo "Nechráněný release preflight je v NODE_ENV=production zakázaný." >&2
      return 1
    fi
    if [[ "${NODE_ENV:-}" != "development" && "${NODE_ENV:-}" != "test" ]] || [[ "${PPSTUDIO_RELEASE_UNSCOPED_TARGET:-}" != "DEV" ]]; then
      echo "Nechráněný release preflight vyžaduje NODE_ENV=development/test a PPSTUDIO_RELEASE_UNSCOPED_TARGET=DEV." >&2
      return 1
    fi
  fi

  [[ "${RELEASE_CPU_QUOTA}" =~ ^([1-9][0-9]{0,3}|10000)%$ ]] || {
    echo "PPSTUDIO_RELEASE_CPU_QUOTA musí být procento 1–10000 (např. 100%)." >&2
    return 1
  }
  [[ "${RELEASE_CPU_WEIGHT}" =~ ^([1-9][0-9]{0,3}|10000)$ ]] || {
    echo "PPSTUDIO_RELEASE_CPU_WEIGHT musí být celé číslo 1–10000." >&2
    return 1
  }
  [[ "${RELEASE_IO_WEIGHT}" =~ ^([1-9][0-9]{0,3}|10000)$ ]] || {
    echo "PPSTUDIO_RELEASE_IO_WEIGHT musí být celé číslo 1–10000." >&2
    return 1
  }
  [[ "${RELEASE_TASKS_MAX}" =~ ^[1-9][0-9]*$ ]] || {
    echo "PPSTUDIO_RELEASE_TASKS_MAX musí být kladné celé číslo." >&2
    return 1
  }
  [[ "${RELEASE_NICE}" =~ ^-?[0-9]+$ ]] && (( RELEASE_NICE >= -20 && RELEASE_NICE <= 19 )) || {
    echo "PPSTUDIO_RELEASE_NICE musí být celé číslo od -20 do 19." >&2
    return 1
  }
}

run_release_preflight_command() {
  if [[ "${RELEASE_CGROUP_MODE}" == "off" ]]; then
    "$@"
    return
  fi

  local unit_name
  local exit_status=0
  local sudo_loader='while IFS= read -r -d "" entry; do export "$entry"; done; exec /usr/bin/systemd-run "$@"'
  local -a runner=(systemd-run)
  RELEASE_CGROUP_SEQUENCE=$((RELEASE_CGROUP_SEQUENCE + 1))
  unit_name="ppstudio-release-preflight-${BASHPID}-${RELEASE_CGROUP_SEQUENCE}"

  require_cmd systemd-run
  require_cmd numfmt
  local memory_high_bytes memory_max_bytes
  # Konečné absolutní velikosti: nelze ověřovat infinity ani procenta RAM.
  memory_high_bytes="$(numfmt --from=iec "${RELEASE_MEMORY_HIGH}")" || return 1
  memory_max_bytes="$(numfmt --from=iec "${RELEASE_MEMORY_MAX}")" || return 1
  [[ "${memory_high_bytes}" =~ ^[1-9][0-9]*$ && "${memory_max_bytes}" =~ ^[1-9][0-9]*$ ]] || return 1
  if [[ "${EUID}" -ne 0 ]]; then
    require_cmd sudo
    runner=(sudo /bin/bash -c "${sudo_loader}" --)
  fi

  log "cgroup ${unit_name}: CPUQuota=${RELEASE_CPU_QUOTA}, CPUWeight=${RELEASE_CPU_WEIGHT}, IOWeight=${RELEASE_IO_WEIGHT}, MemoryHigh=${RELEASE_MEMORY_HIGH}, MemoryMax=${RELEASE_MEMORY_MAX}"
  local -a scope_command=(
    "${runner[@]}"
    --scope \
    --collect \
    --quiet \
    --expand-environment=no \
    --unit="${unit_name}" \
    --uid="$(id -u)" \
    --gid="$(id -g)" \
    --working-directory="${PWD}" \
    --nice="${RELEASE_NICE}" \
    -p "CPUQuota=${RELEASE_CPU_QUOTA}" \
    -p "CPUWeight=${RELEASE_CPU_WEIGHT}" \
    -p "IOWeight=${RELEASE_IO_WEIGHT}" \
    -p "MemoryHigh=${RELEASE_MEMORY_HIGH}" \
    -p "MemoryMax=${RELEASE_MEMORY_MAX}" \
    -p "TasksMax=${RELEASE_TASKS_MAX}" \
    -- /bin/bash "${SCRIPT_DIR}/release-scope.sh"
    "${unit_name}" "${RELEASE_CPU_QUOTA}" "${memory_high_bytes}" "${memory_max_bytes}"
    "${RELEASE_TASKS_MAX}" "${RELEASE_CPU_WEIGHT}" "${RELEASE_IO_WEIGHT}" "$@"
  )
  if [[ "${EUID}" -ne 0 ]]; then
    if release_preflight_print_environment | "${scope_command[@]}"; then
      exit_status=0
    else
      exit_status=$?
    fi
  elif "${scope_command[@]}"; then
    exit_status=0
  else
    exit_status=$?
  fi
  return "${exit_status}"
}

release_preflight_print_environment() {
  local entry
  local name

  require_cmd env
  if ! env -0 | while IFS= read -r -d '' entry; do
    name="${entry%%=*}"
    [[ "${name}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    case "${name}" in
      BASH_FUNC_*|BASH_ENV|CDPATH|DYLD_*|ENV|GCONV_PATH|LD_*|SUDO_*)
        continue
        ;;
    esac
    printf '%s\0' "${entry}"
  done; then
    echo "Nelze bezpečně předat prostředí release preflightu; release se zastavuje." >&2
    return 1
  fi
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

acquire_release_lock() {
  local lock_dir
  lock_dir="$(git -C "${REPO_DIR}" rev-parse --git-common-dir)" || return 1
  [[ "${lock_dir}" == /* ]] || lock_dir="${REPO_DIR}/${lock_dir}"
  exec {RELEASE_LOCK_FD}> "${lock_dir}/ppstudio-release.lock" || return 1
  if ! flock -n "${RELEASE_LOCK_FD}"; then
    echo "Jiný release právě běží; souběžné nasazení není povolené." >&2
    return 1
  fi
}

run_release_tests() {
  # Dotenv nesmí ani při zděděném RUN_DB_INTEGRATION_TESTS=1 zapnout zápisy do DB.
  RUN_DB_INTEGRATION_TESTS=0 run_release_preflight_command npm run test:release
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

finish_release() {
  local exit_status=$?
  if [[ "${exit_status}" -ne 0 && "${RELEASE_WRITERS_STOPPED}" -eq 1 ]]; then
    sudo systemctl stop "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}" || echo "Nepodařilo se zastavit služby; ověř jejich stav ručně." >&2
    echo "Release selhal po zahájení odstávky. Služby zůstávají zastavené; před ručním startem ověř migrace a kompatibilitu DB. Záloha ani DB rollback se neprovádí automaticky." >&2
  fi
  if [[ "${exit_status}" -ne 0 && "${SYSTEMD_UNITS_CHANGED}" -eq 1 ]]; then
    if ! restore_systemd_units; then
      echo "Obnova systemd unitů selhala; záloha zůstává v ${SYSTEMD_BACKUP_DIR}." >&2
      return "${exit_status}"
    fi
  fi
  if [[ -n "${SYSTEMD_BACKUP_DIR}" ]]; then
    rm -rf -- "${SYSTEMD_BACKUP_DIR}" || echo "Nepodařilo se uklidit zálohu unitů ${SYSTEMD_BACKUP_DIR}." >&2
  fi
  cleanup_release_workspace || echo "Nepodařilo se uklidit staging workspace." >&2
  return "${exit_status}"
}

cleanup_old_releases() {
  local current_target=""
  local previous_target=""
  local release_dir
  local releases_root
  local additional_kept=0

  if ! [[ "${RETAIN_RELEASES}" =~ ^[0-9]+$ ]]; then
    echo "--keep-releases musí být nezáporné celé číslo." >&2
    return 1
  fi

  releases_root="$(readlink -f -- "${RELEASES_DIR}")" || return 1

  if [[ -L "${CURRENT_RELEASE_LINK}" ]]; then
    current_target="$(readlink -f "${CURRENT_RELEASE_LINK}")" || return 1
  fi
  if [[ -L "${PREVIOUS_RELEASE_LINK}" ]]; then
    previous_target="$(readlink -f "${PREVIOUS_RELEASE_LINK}")" || return 1
  fi

  while IFS= read -r -d '' release_dir; do
    release_dir="${RELEASES_DIR}/${release_dir}"
    case "$(basename "${release_dir}")" in
      [0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]) ;;
      *) continue ;;
    esac

    release_dir="$(readlink -f -- "${release_dir}")" || return 1
    if [[ "$(dirname "${release_dir}")" != "${releases_root}" ]]; then
      echo "Úklid odmítá cestu mimo release adresář: ${release_dir}." >&2
      return 1
    fi

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
    sudo rm -rf -- "${release_dir}" || return 1
  done < <(find "${RELEASES_DIR}" -mindepth 1 -maxdepth 1 -type d -printf '%f\0' | sort -z -t '-' -k2,2r)
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

run_voucher_template_bootstrap() {
  log "npm run voucher:templates:bootstrap (po migraci, před aktivací release)"
  npm run voucher:templates:bootstrap
}

assert_release_writers_stopped() {
  local unit_name active_state

  for unit_name in "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}"; do
    if ! active_state="$(sudo systemctl show --property=ActiveState --value "${unit_name}")"; then
      echo "Nelze ověřit stav služby ${unit_name}; migrace je zakázaná." >&2
      return 1
    fi
    case "${active_state}" in
      inactive|failed) ;;
      *)
        echo "Služba ${unit_name} nemá potvrzený zastavený stav (${active_state:-unknown}); migrace je zakázaná." >&2
        return 1
        ;;
    esac
  done
}

stop_release_writers() {
  log "stop writerů ${WEB_UNIT_NAME}/${WORKER_UNIT_NAME}"
  sudo systemctl stop "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}"
  assert_release_writers_stopped
}

wait_for_web_listener() {
  local attempt

  for ((attempt = 1; attempt <= WEB_READY_RETRIES; attempt++)); do
    # Po systemctl start Next.js ještě krátce neotevře port. Tento tichý probe
    # rozlišuje očekávaný start od skutečného selhání health/smoke kontroly.
    if curl --silent --output /dev/null --max-time 1 "${LIVENESS_URL}"; then
      return 0
    fi

    sleep "${WEB_READY_RETRY_SECONDS}"
  done

  log "Web po startu nezačal naslouchat (${LIVENESS_URL}) ani po ${WEB_READY_RETRIES} pokusech."
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

  echo "Nový release neprošel startem nebo health/smoke testem; runtime ponechávám fail-closed zastavený." >&2
  sudo systemctl stop "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}" >/dev/null 2>&1 || true

  if [[ -n "${previous_target}" ]]; then
    set_release_link "${CURRENT_RELEASE_LINK}" "${previous_target}"
  else
    rm -f "${CURRENT_RELEASE_LINK}"
  fi

  echo "Symlink byl vrácen, ale starý runtime nebyl automaticky spuštěn nad změněným schématem. Zkontroluj migraci, kompatibilitu a journalctl." >&2
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

  assert_release_writers_stopped || return 1
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

backup_systemd_units() {
  local unit_name unit_file
  SYSTEMD_BACKUP_DIR="$(mktemp -d)"
  for unit_name in "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}"; do
    unit_file="$(unit_file_name "${unit_name}")"
    if sudo test -e "${SYSTEMD_DIR}/${unit_file}" || sudo test -L "${SYSTEMD_DIR}/${unit_file}"; then
      sudo cp -a -- "${SYSTEMD_DIR}/${unit_file}" "${SYSTEMD_BACKUP_DIR}/${unit_file}"
    fi
  done
}

restore_systemd_units() {
  local unit_name unit_file
  for unit_name in "${WEB_UNIT_NAME}" "${WORKER_UNIT_NAME}"; do
    unit_file="$(unit_file_name "${unit_name}")"
    sudo rm -f -- "${SYSTEMD_DIR}/${unit_file}" || return 1
    if [[ -e "${SYSTEMD_BACKUP_DIR}/${unit_file}" || -L "${SYSTEMD_BACKUP_DIR}/${unit_file}" ]]; then
      sudo cp -a -- "${SYSTEMD_BACKUP_DIR}/${unit_file}" "${SYSTEMD_DIR}/${unit_file}" || return 1
    fi
  done
  sudo systemctl daemon-reload || return 1
  SYSTEMD_UNITS_CHANGED=0
}

sync_systemd_units() {
  log "synchronizuji systemd unity z deploy/systemd"
  sudo install -d -m 0755 /etc/sysusers.d /etc/tmpfiles.d
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

  if [[ "${path_value}" != /* ]]; then
    echo "${label} musí být absolutní cesta: ${path_value}." >&2
    return 1
  fi
  resolved_path="$(readlink -m -- "${path_value}")" || return 1

  # Povolené jsou vyhrazené datové adresáře, nikdy systémové kořeny.
  # U mountů požadujeme podadresář, aby se neměnila práva celého mountu.
  case "${resolved_path}" in
    /var/www/*|/var/lib/ppstudio|/var/lib/ppstudio/*|/srv/*|/mnt/*/*|/media/*/*|/tmp/*) ;;
    *)
      echo "${label} není bezpečná datová cesta: ${path_value}. Použij vyhrazený adresář pod /var/www, /var/lib/ppstudio nebo /srv, případně podadresář mountu v /mnt či /media." >&2
      return 1
      ;;
  esac
}

prepare_runtime_storage() {
  local media_root="${MEDIA_STORAGE_ROOT:-/var/www/ppstudio/uploads}"
  local snapshot_path="${SITE_SETTINGS_SNAPSHOT_PATH:-/var/lib/ppstudio/site-settings-snapshot.json}"
  local legacy_snapshot_path="${REPO_DIR}/site-settings-snapshot.json"
  local snapshot_dir
  local repo_path
  validate_runtime_path "${media_root}" "MEDIA_STORAGE_ROOT" || return 1
  validate_runtime_path "${snapshot_path}" "SITE_SETTINGS_SNAPSHOT_PATH" || return 1
  media_root="$(readlink -m -- "${media_root}")"
  snapshot_path="$(readlink -m -- "${snapshot_path}")"
  snapshot_dir="$(dirname "${snapshot_path}")"
  repo_path="$(readlink -m -- "${REPO_DIR}")"

  validate_runtime_path "${media_root}" "MEDIA_STORAGE_ROOT" || return 1
  validate_runtime_path "${snapshot_dir}" "Adresář SITE_SETTINGS_SNAPSHOT_PATH" || return 1
  if [[ "${media_root}" == "${repo_path}" || "${repo_path}" == "${media_root}"/* || ( "${media_root}" == "${repo_path}"/* && "${media_root}" != "${repo_path}/uploads" ) ]]; then
    echo "MEDIA_STORAGE_ROOT nesmí mířit do checkoutu ${repo_path}; použij externí storage nebo ${repo_path}/uploads." >&2
    return 1
  fi
  if [[ "${snapshot_dir}" == "${repo_path}" || "${snapshot_dir}" == "${repo_path}"/* || "${repo_path}" == "${snapshot_dir}"/* ]]; then
    echo "SITE_SETTINGS_SNAPSHOT_PATH nesmí ležet v checkoutu ${repo_path}; použij /var/lib/ppstudio/site-settings-snapshot.json." >&2
    return 1
  fi

  if [[ "${1:-}" == "--validate-only" ]]; then
    return 0
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
  local releases_root repo_path
  release_dir="$(readlink -f -- "${release_dir}")" || return 1
  releases_root="$(readlink -m -- "${RELEASES_DIR}")" || return 1
  repo_path="$(readlink -f -- "${REPO_DIR}")" || return 1
  # První provisioning může mít current přímo na checkout; jinak jen release.
  if [[ "${release_dir}" != "${repo_path}" && "$(dirname "${release_dir}")" != "${releases_root}" ]]; then
    echo "Oprávnění odmítám měnit mimo checkout a release adresář: ${release_dir}." >&2
    return 1
  fi

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
  REPO_DIR="$(cd "${REPO_DIR}" && pwd -P)"
  cd "${REPO_DIR}"

  require_cmd git
  require_cmd flock
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

  acquire_release_lock || exit 1
  if ! [[ "${RETAIN_RELEASES}" =~ ^[0-9]+$ ]]; then
    echo "--keep-releases musí být nezáporné celé číslo." >&2
    exit 1
  fi
  validate_runtime_path "${RELEASES_DIR}" "PPSTUDIO_RELEASES_DIR"
  RELEASES_DIR="$(readlink -m -- "${RELEASES_DIR}")"
  if [[ "${REPO_DIR}" == "${RELEASES_DIR}" || "${REPO_DIR}" == "${RELEASES_DIR}"/* ]]; then
    echo "PPSTUDIO_RELEASES_DIR nesmí obsahovat pracovní checkout." >&2
    exit 1
  fi

  load_runtime_env
  resolve_release_memory_limits
  validate_release_resource_limits
  prepare_runtime_storage --validate-only
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

  run_timed_step "kontrola lokálních migrací" check_local_migration_directories

  run_timed_step "příprava deployment environmentu" prepare_deployment_env

  trap finish_release EXIT
  run_timed_step "vytvoření staging workspace" create_release_workspace

  cd "${RELEASE_BUILD_DIR}"

  log "npm ci --include=dev (izolovaný release cgroup)"
  run_timed_step "npm ci" run_release_preflight_command npm ci --include=dev

  log "npm run db:generate"
  run_timed_step "Prisma generate" run_release_preflight_command npm run db:generate

  log "npm run db:check-migrations"
  run_timed_step "kontrola historie migrací" run_release_preflight_command npm run db:check-migrations

  log "npx prisma validate (bez zápisu do DB)"
  run_timed_step "Prisma validate" run_release_preflight_command npx prisma validate

  if [[ "${SKIP_LINT}" -ne 1 ]]; then
    log "npm run lint"
    run_timed_step "lint" run_release_preflight_command npm run lint
  else
    log "Přeskakuji lint (--skip-lint)."
  fi

  log "npm run typecheck"
  run_timed_step "typecheck" run_release_preflight_command npm run typecheck

  # Produkční .env nesmí spouštět zapisující DB integrační testy. Tento běh
  # ověřuje unit/regresní testy; DB integrační a E2E zůstávají CI bránou.
  log "npm run test:release (bez produkční DB)"
  run_timed_step "test:release" run_release_tests

  log "npm run build (izolovaný release cgroup)"
  run_timed_step "build" run_release_preflight_command npm run build

  run_timed_step "zápis runtime release environmentu" write_runtime_release_env_file "${RELEASE_BUILD_DIR}/${RUNTIME_RELEASE_ENV_FILE}"

  local release_name
  local release_dir
  release_name="${GIT_HASH}-$(date -u +%Y%m%d%H%M%S)"
  release_dir="${RELEASES_DIR}/${release_name}"
  run_timed_step "finalizace release workspace" mv "${RELEASE_BUILD_DIR}" "${release_dir}"
  RELEASE_BUILD_DIR=""
  cd "${REPO_DIR}"
  RELEASE_WRITERS_STOPPED=1
  run_timed_step "zastavení a ověření writerů" stop_release_writers

  run_timed_step "záloha systemd unitů" backup_systemd_units
  SYSTEMD_UNITS_CHANGED=1
  run_timed_step "synchronizace systemd unitů" sync_systemd_units
  run_timed_step "příprava runtime storage" prepare_runtime_storage
  run_timed_step "runtime oprávnění release" prepare_runtime_release "${release_dir}"

  cd "${release_dir}"
  log "npx prisma migrate deploy (writeři jsou ověřeně zastavení)"
  run_timed_step "Prisma migrate deploy" npx prisma migrate deploy

  log "Povinný voucher template bootstrap (nový release, stejný env a private storage)"
  run_timed_step "voucher template bootstrap" run_voucher_template_bootstrap

  cd "${REPO_DIR}"
  run_timed_step "aktivace release" activate_release "${release_dir}"
  RELEASE_WRITERS_STOPPED=0
  SYSTEMD_UNITS_CHANGED=0
  local cleanup_started_at=${SECONDS}
  if ! cleanup_old_releases; then
    log "VAROVÁNÍ: release je nasazený, ale úklid starších verzí selhal."
  fi
  RELEASE_STEP_DURATIONS+=("úklid starších releasů: $((SECONDS - cleanup_started_at)) s.")

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
