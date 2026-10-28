#!/usr/bin/env bash
set -euo pipefail

# Izolované regresní scénáře release mechanismu; nespouštějí npm, Prisma ani systemd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/release.sh"

[[ "${RETAIN_RELEASES}" -eq 0 ]]

grep -q '^User=ppstudio$' "${SCRIPT_DIR}/systemd/ppstudio-web.service"
grep -q '^Group=ppstudio$' "${SCRIPT_DIR}/systemd/ppstudio-email-worker.service"
grep -q '^Environment=HOSTNAME=0.0.0.0$' "${SCRIPT_DIR}/systemd/ppstudio-web.service"
grep -q '^ProtectSystem=full$' "${SCRIPT_DIR}/systemd/ppstudio-web.service"
grep -q '^ProtectHome=true$' "${SCRIPT_DIR}/systemd/ppstudio-web.service"
grep -q '^StateDirectory=ppstudio$' "${SCRIPT_DIR}/systemd/ppstudio-web.service"
! grep -q '^\(AmbientCapabilities\|CapabilityBoundingSet\|PermissionsStartOnly\)=' "${SCRIPT_DIR}/systemd/ppstudio-web.service"
! grep -q '^\(AmbientCapabilities\|CapabilityBoundingSet\|PermissionsStartOnly\)=' "${SCRIPT_DIR}/systemd/ppstudio-email-worker.service"
grep -q 'install -d -m 0755 /etc/sysusers.d /etc/tmpfiles.d' "${SCRIPT_DIR}/release.sh"
if validate_runtime_path "/" "test" >/dev/null 2>&1; then
  echo "Nebezpečně široká runtime cesta byla neočekávaně přijata." >&2
  exit 1
fi
for unsafe_path in /etc /etc/ppstudio /usr /usr/local /home /var/lib /var/lib/postgresql /srv /mnt /mnt/storage /media /tmp relative/path; do
  if validate_runtime_path "${unsafe_path}" "test" >/dev/null 2>&1; then
    echo "Nebezpečná runtime cesta byla přijata: ${unsafe_path}." >&2
    exit 1
  fi
done
validate_runtime_path "/var/lib/ppstudio" "test"
validate_runtime_path "/var/www/ppstudio-uploads" "test"
validate_runtime_path "/mnt/storage/ppstudio" "test"

if "${SCRIPT_DIR}/release.sh" --allow-dirty >/dev/null 2>&1; then
  echo "Odstraněná volba --allow-dirty byla neočekávaně přijata." >&2
  exit 1
fi

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TEMP_DIR}"' EXIT
REPO_DIR="${TEMP_DIR}/repo"
RELEASES_DIR="${REPO_DIR}/releases"
CURRENT_RELEASE_LINK="${REPO_DIR}/current"
PREVIOUS_RELEASE_LINK="${REPO_DIR}/previous"
HEALTH_RETRIES=1
HEALTH_RETRY_SECONDS=0
WEB_READY_RETRIES=1
WEB_READY_RETRY_SECONDS=0
NEXT_DEPLOYMENT_ID="test-release"
export NEXT_DEPLOYMENT_ID
mkdir -p "${RELEASES_DIR}/old" "${RELEASES_DIR}/new/node_modules" "${RELEASES_DIR}/new/.next"
touch "${RELEASES_DIR}/new/package.json"
ln -s "${RELEASES_DIR}/old" "${CURRENT_RELEASE_LINK}"

archive_repo="${TEMP_DIR}/archive-repo"
archive_releases_dir="${archive_repo}/releases"
mkdir -p "${archive_repo}"
git -C "${archive_repo}" init --quiet
git -C "${archive_repo}" config user.email 'release-test@example.test'
git -C "${archive_repo}" config user.name 'Release test'
printf 'commitnuty obsah\n' > "${archive_repo}/artifact.txt"
printf 'TEST_ENV=1\n' > "${archive_repo}/.env"
git -C "${archive_repo}" add artifact.txt
git -C "${archive_repo}" commit --quiet -m 'Počáteční artefakt'
printf 'necommitnuty obsah\n' > "${archive_repo}/artifact.txt"
printf 'lokalni soubor\n' > "${archive_repo}/untracked.txt"
[[ -n "$(git -C "${archive_repo}" status --porcelain)" ]]

saved_repo_dir="${REPO_DIR}"
saved_releases_dir="${RELEASES_DIR}"
REPO_DIR="${archive_repo}"
RELEASES_DIR="${archive_releases_dir}"
if ensure_clean_worktree; then
  echo "Dirty working tree nebyl odmítnut." >&2
  exit 1
fi
RELEASE_BUILD_DIR=""
create_release_workspace
[[ "$(<"${RELEASE_BUILD_DIR}/artifact.txt")" == 'commitnuty obsah' ]]
[[ ! -e "${RELEASE_BUILD_DIR}/untracked.txt" ]]
cleanup_release_workspace

# Cache přežije změnu staging cesty; přenáší jen kompilaci a invaliduje env.
(
  cd "${archive_repo}"
  printf '{}\n' > package-lock.json
  printf 'export default {};\n' > next.config.ts
  restore_build_cache
  [[ ! -e .next/cache ]]
  mkdir -p .next/cache/{turbopack,swc,fetch-cache}
  printf 'compiled\n' > .next/cache/turbopack/artifact
  printf 'swc\n' > .next/cache/swc/artifact
  printf 'runtime data\n' > .next/cache/fetch-cache/private
  save_build_cache
  [[ ! -e "${RELEASES_DIR}/.build-cache/fetch-cache" ]]
  mkdir "${archive_repo}/second-staging"
  cp package-lock.json next.config.ts .env "${archive_repo}/second-staging/"
  cd "${archive_repo}/second-staging"
  restore_build_cache
  [[ "$(<.next/cache/turbopack/artifact)" == compiled ]]
  [[ "$(<.next/cache/swc/artifact)" == swc ]]
  [[ ! -e .next/cache/fetch-cache ]]
  rm -rf .next
  printf 'TEST_ENV=2\n' > .env
  restore_build_cache
  [[ ! -e .next/cache ]]
  cp "${archive_repo}/.env" .env
  printf '{"changed":true}\n' > package-lock.json
  restore_build_cache
  [[ ! -e .next/cache ]]
  cp "${archive_repo}/package-lock.json" package-lock.json
  printf 'export default { experimental: {} };\n' > next.config.ts
  restore_build_cache
  [[ ! -e .next/cache ]]
  cp "${archive_repo}/next.config.ts" next.config.ts
  rm "${RELEASES_DIR}/.build-cache/key"
  restore_build_cache
  [[ ! -e .next/cache ]]
  save_build_cache
  parse_args --no-cache
  restore_build_cache
  [[ ! -e .next/cache ]]
  mkdir -p .next/cache/turbopack
  printf 'disabled\n' > .next/cache/turbopack/artifact
  save_build_cache
  [[ -f "${RELEASES_DIR}/.build-cache/key" ]]
  [[ ! -e "${RELEASES_DIR}/.build-cache/turbopack" ]]
)
# Zámek sdílí i různé cesty přes symlink; po ukončení držitele se uvolní.
ln -s "${archive_repo}" "${TEMP_DIR}/archive-alias"
(
  acquire_release_lock
  if PPSTUDIO_REPO_DIR="${TEMP_DIR}/archive-alias" bash -c 'source "$1"; acquire_release_lock' _ "${SCRIPT_DIR}/release.sh"; then
    echo "Souběžný release nebyl odmítnut." >&2
    exit 1
  fi
)
(acquire_release_lock)
REPO_DIR="${saved_repo_dir}"
RELEASES_DIR="${saved_releases_dir}"

START_FAIL=""
CURL_FAIL=0
SUDO_RM_SEEN=0
WEB_ACTIVE=0
WORKER_ACTIVE=0
sudo() {
  if [[ "$1" == "rm" && "$2" == "-rf" ]]; then
    SUDO_RM_SEEN=1
  fi
  "$@"
}

RUNTIME_USER="$(id -un)"
RUNTIME_GROUP="$(id -gn)"
MEDIA_STORAGE_ROOT="${TEMP_DIR}/media"
SITE_SETTINGS_SNAPSHOT_PATH="${TEMP_DIR}/state/site-settings-snapshot.json"
touch "${REPO_DIR}/.env"
(
  sudo() { touch "${TEMP_DIR}/unexpected-sudo"; }
  MEDIA_STORAGE_ROOT=/etc
  if prepare_runtime_storage --validate-only >/dev/null 2>&1; then
    echo "Storage přijalo systémový adresář." >&2
    exit 1
  fi
  if prepare_runtime_release /etc >/dev/null 2>&1; then
    echo "Oprávnění release přijala systémový adresář." >&2
    exit 1
  fi
  [[ ! -e "${TEMP_DIR}/unexpected-sudo" ]]
)
MEDIA_STORAGE_ROOT="${REPO_DIR}"
if prepare_runtime_storage >/dev/null 2>&1; then
  echo "MEDIA_STORAGE_ROOT nesmí převzít checkout." >&2
  exit 1
fi
MEDIA_STORAGE_ROOT="${TEMP_DIR}"
if prepare_runtime_storage --validate-only >/dev/null 2>&1; then
  echo "Storage nesmí převzít nadřazený adresář checkoutu." >&2
  exit 1
fi
MEDIA_STORAGE_ROOT="${TEMP_DIR}/media"
prepare_runtime_storage --validate-only
[[ ! -e "${MEDIA_STORAGE_ROOT}" ]]
prepare_runtime_storage
[[ "$(stat -c '%a' "${MEDIA_STORAGE_ROOT}")" == "750" ]]
chmod 0644 "${RELEASES_DIR}/new/package.json"
prepare_runtime_release "${RELEASES_DIR}/new"
[[ "$(stat -c '%a' "${RELEASES_DIR}/new/package.json")" == "640" ]]

systemctl() {
  case "$1" in
    start)
      [[ "${START_FAIL}" != "$2" ]] || return 1
      if [[ "$2" == "${WEB_UNIT_NAME}" ]]; then
        WEB_ACTIVE=1
      elif [[ "$2" == "${WORKER_UNIT_NAME}" ]]; then
        WORKER_ACTIVE=1
      fi
      ;;
    stop)
      WEB_ACTIVE=0
      WORKER_ACTIVE=0
      ;;
    is-active)
      local unit_name="${*: -1}"
      if [[ "${unit_name}" == "${WEB_UNIT_NAME}" ]]; then
        [[ "${WEB_ACTIVE}" -eq 1 ]]
      else
        [[ "${WORKER_ACTIVE}" -eq 1 ]]
      fi
      ;;
    show)
      local unit_name="${*: -1}"
      if [[ "${unit_name}" == "${WEB_UNIT_NAME}" && "${WEB_ACTIVE}" -eq 1 ]] || [[ "${unit_name}" == "${WORKER_UNIT_NAME}" && "${WORKER_ACTIVE}" -eq 1 ]]; then
        printf 'active\n'
      else
        printf 'inactive\n'
      fi
      ;;
    daemon-reload|status) return 0 ;;
    *) return 0 ;;
  esac
}
curl() {
  local output_file=""
  local write_out=0
  local previous_argument=""
  local argument

  [[ "${CURL_FAIL}" -eq 0 ]] || return 1

  for argument in "$@"; do
    if [[ "${previous_argument}" == "--output" ]]; then
      output_file="${argument}"
    fi
    if [[ "${argument}" == "--write-out" ]]; then
      write_out=1
    fi
    previous_argument="${argument}"
  done

  if [[ "${*: -1}" == *"api/health"* ]]; then
    if [[ -n "${output_file}" ]]; then
      printf '{"status":"ok"}\n' > "${output_file}"
    else
      printf '{"status":"ok"}\n'
    fi
  else
    if [[ -n "${output_file}" ]]; then
      printf '<html>ok</html>\n' > "${output_file}"
    else
      printf '<html>ok</html>\n'
    fi
  fi

  if [[ "${write_out}" -eq 1 ]]; then
    printf '200'
  fi
}

assert_old_current() {
  [[ "$(readlink -f "${CURRENT_RELEASE_LINK}")" == "${RELEASES_DIR}/old" ]]
}

expect_rollback() {
  if activate_release "${RELEASES_DIR}/new"; then
    echo "Očekávaný rollback nenastal." >&2
    exit 1
  fi
  assert_old_current
}

# Selhání webu, workeru a health/smoke obnoví symlink, ale po migraci fail-closed
# nespustí starý runtime nad potenciálně nekompatibilním schématem.
START_FAIL="ppstudio-web"; expect_rollback
START_FAIL="ppstudio-email-worker"; expect_rollback
START_FAIL=""; CURL_FAIL=1; expect_rollback
[[ "${WEB_ACTIVE}" -eq 0 && "${WORKER_ACTIVE}" -eq 0 ]]

# Typecheck, bezpečný test i build musí předcházet zastavení runtime. Migrace
# smí následovat až po stopu + ověření writerů a před aktivací/startem.
bootstrap_command="$(node -p 'require("./package.json").scripts["voucher:templates:bootstrap"]')"
[[ "${bootstrap_command}" == *"node --conditions=react-server "* ]]
[[ "${bootstrap_command}" == *"--import tsx scripts/bootstrap-voucher-templates.ts"* ]]
[[ "${bootstrap_command}" != *"src/test/register-server-only.mjs"* ]]
ci_fixtures_command="$(node -p 'require("./package.json").scripts["ci:prepare-voucher-fixtures"]')"
[[ "${ci_fixtures_command}" == *"node --conditions=react-server "* ]]
[[ "${ci_fixtures_command}" == *"--import tsx scripts/prepare-ci-voucher-fixtures.ts"* ]]
[[ "${ci_fixtures_command}" != *"src/test/register-server-only.mjs"* ]]
grep -Fq 'npm run voucher:templates:bootstrap' "${SCRIPT_DIR}/release.sh"
typecheck_line="$(grep -n 'npm run typecheck' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
test_line="$(grep -n 'npm run test:release' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
build_line="$(grep -n 'npm run build' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
stop_line="$(grep -n 'run_timed_step "zastavení a ověření writerů" stop_release_writers' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
migrate_line="$(grep -n 'npx prisma migrate deploy (writeři jsou ověřeně zastavení)' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
bootstrap_line="$(grep -n 'run_timed_step "voucher template bootstrap" run_voucher_template_bootstrap' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
activate_line="$(grep -n 'activate_release "\${release_dir}"' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
activate_swap_line="$(grep -n 'set_release_link "\${CURRENT_RELEASE_LINK}" "\${release_dir}"' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
activate_start_line="$(grep -n 'if start_release_services && wait_for_web_listener' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
sync_line="$(grep -n 'run_timed_step "synchronizace systemd unitů"' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
storage_line="$(grep -n 'run_timed_step "příprava runtime storage"' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
permissions_line="$(grep -n 'run_timed_step "runtime oprávnění release"' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
[[ "${build_line}" -lt "${permissions_line}" && "${permissions_line}" -lt "${stop_line}" ]]
grep -Fq 'run_timed_step "build" npm --ignore-scripts run build' "${SCRIPT_DIR}/release.sh"
[[ "${stop_line}" -lt "${sync_line}" && "${sync_line}" -lt "${storage_line}" && "${storage_line}" -lt "${migrate_line}" ]]
[[ "${typecheck_line}" -lt "${test_line}" && "${test_line}" -lt "${build_line}" && "${build_line}" -lt "${stop_line}" && "${stop_line}" -lt "${migrate_line}" && "${migrate_line}" -lt "${bootstrap_line}" && "${bootstrap_line}" -lt "${activate_line}" && "${activate_swap_line}" -lt "${activate_start_line}" ]]

# Bootstrap je fail-closed krok: jeho neúspěch nesmí pokračovat do aktivace.
ACTIVATE_CALLED=0
npm() {
  if [[ "$1" == "run" && "$2" == "voucher:templates:bootstrap" ]]; then
    return 1
  fi
  return 0
}
activate_release() {
  ACTIVATE_CALLED=1
}
if run_voucher_template_bootstrap; then
  echo "Selhání bootstrapu bylo neočekávaně ignorováno." >&2
  exit 1
fi
[[ "${ACTIVATE_CALLED}" -eq 0 ]]
# Produkční dotenv i zděděný shell flag nesmí zapnout DB integrační testy.
printf 'RUN_DB_INTEGRATION_TESTS=1\n' > "${TEMP_DIR}/test.env"
npm() {
  [[ "$1" == "run" && "$2" == "test:release" ]]
  node --env-file="${TEMP_DIR}/test.env" -e 'if (process.env.RUN_DB_INTEGRATION_TESTS !== "0") process.exit(1)'
}
RUN_DB_INTEGRATION_TESTS=1 run_release_tests
unset -f npm activate_release

WEB_ACTIVE=1
WORKER_ACTIVE=1
stop_release_writers
[[ "${WEB_ACTIVE}" -eq 0 && "${WORKER_ACTIVE}" -eq 0 ]]

# Chyba dotazu ani přechodný/prázdný stav nesmí povolit migraci.
for state in active activating deactivating reloading unknown ''; do
  (
    systemctl() { printf '%s\n' "${state}"; }
    if assert_release_writers_stopped; then
      echo "Nepovolený stav prošel kontrolou: ${state}" >&2
      exit 1
    fi
  )
done
(
  systemctl() { return 1; }
  if assert_release_writers_stopped; then
    echo "Chyba systemctl prošla kontrolou." >&2
    exit 1
  fi
)

# Obnova unitů zachová původní soubor i symlink a odstraní nově instalovanou unitu.
(
  SYSTEMD_DIR="${TEMP_DIR}/systemd"
  mkdir -p "${SYSTEMD_DIR}"
  printf 'původní web\n' > "${SYSTEMD_DIR}/${WEB_UNIT_NAME}.service"
  ln -s /missing/vendor-worker.service "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}.service"
  backup_systemd_units
  rm "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}.service"
  printf 'nový web\n' > "${SYSTEMD_DIR}/${WEB_UNIT_NAME}.service"
  touch "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}.service"
  SYSTEMD_UNITS_CHANGED=1
  restore_systemd_units
  [[ "$(<"${SYSTEMD_DIR}/${WEB_UNIT_NAME}.service")" == 'původní web' ]]
  [[ "$(readlink "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}.service")" == /missing/vendor-worker.service ]]
  rm -rf "${SYSTEMD_BACKUP_DIR}"
  rm "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}.service"
  backup_systemd_units
  touch "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}.service"
  restore_systemd_units
  [[ ! -e "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}.service" ]]
  rm -rf "${SYSTEMD_BACKUP_DIR}"
)

# Hash nesmí ovlivnit ponechání nejnovější další verze.
(
  RELEASES_DIR="${TEMP_DIR}/retention"
  mkdir -p "${RELEASES_DIR}/ffffffffffff-20260101000000" "${RELEASES_DIR}/111111111111-20261013000000"
  RETAIN_RELEASES=1
  cleanup_old_releases
  [[ -d "${RELEASES_DIR}/111111111111-20261013000000" ]]
  [[ ! -e "${RELEASES_DIR}/ffffffffffff-20260101000000" ]]
  RETAIN_RELEASES=0
  sudo() { return 1; }
  if cleanup_old_releases; then
    echo "Selhání mazání nebylo propagováno." >&2
    exit 1
  fi
)

# Výchozí úklid nikdy nesmí smazat current/previous ani ponechat další release.
for release in \
  111111111111-20260101000000 \
  222222222222-20260102000000 \
  333333333333-20260103000000 \
  444444444444-20260104000000; do
  mkdir -p "${RELEASES_DIR}/${release}"
done
mkdir -p "${RELEASES_DIR}/333333333333-20260103000000/.next/cache/runtime-owned"
chmod 0700 "${RELEASES_DIR}/333333333333-20260103000000/.next/cache/runtime-owned"
set_release_link "${CURRENT_RELEASE_LINK}" "${RELEASES_DIR}/111111111111-20260101000000"
set_release_link "${PREVIOUS_RELEASE_LINK}" "${RELEASES_DIR}/222222222222-20260102000000"
RETAIN_RELEASES=0
cleanup_old_releases
[[ "${SUDO_RM_SEEN}" -eq 1 ]]
[[ -d "${RELEASES_DIR}/111111111111-20260101000000" ]]
[[ -d "${RELEASES_DIR}/222222222222-20260102000000" ]]
[[ ! -d "${RELEASES_DIR}/444444444444-20260104000000" ]]
[[ ! -d "${RELEASES_DIR}/333333333333-20260103000000" ]]

# Normalizace chrání aktivní a předchozí release i při symlink/relativní cestě.
ln -s "${RELEASES_DIR}" "${TEMP_DIR}/release-alias"
RELEASES_DIR="${TEMP_DIR}/release-alias"
cleanup_old_releases
[[ -d "${RELEASES_DIR}/111111111111-20260101000000" ]]
[[ -d "${RELEASES_DIR}/222222222222-20260102000000" ]]
RELEASES_DIR="$(realpath --relative-to="$PWD" "${RELEASES_DIR}")"
cleanup_old_releases
[[ -d "${RELEASES_DIR}/111111111111-20260101000000" ]]
[[ -d "${RELEASES_DIR}/222222222222-20260102000000" ]]

# Chyba po zahájení odstávky zastaví i částečně spuštěný nový runtime.
WEB_ACTIVE=1
WORKER_ACTIVE=1
RELEASE_WRITERS_STOPPED=1
RELEASE_BUILD_DIR=""
if (exit 7); then :; else
  if finish_release; then
    echo "Chyba release byla ztracena." >&2
    exit 1
  else
    [[ "$?" -eq 7 ]]
  fi
fi
[[ "${WEB_ACTIVE}" -eq 0 && "${WORKER_ACTIVE}" -eq 0 ]]

# Celý orchestrátor s nahrazenými kroky: žádné npm, DB ani systémové služby.
# Samostatný subshell + wait zachová errexit (volání v if by jej vypnulo).
for scenario in build-failure permissions-failure activation-failure cleanup-failure; do
  scenario_dir="${TEMP_DIR}/${scenario}"
  mkdir -p "${scenario_dir}/repo/releases"
  touch "${scenario_dir}/repo/package.json"
  (
    source "${SCRIPT_DIR}/release.sh"
    REPO_DIR="${scenario_dir}/repo"
    RELEASES_DIR="${REPO_DIR}/releases"
    SKIP_PULL=1
    SKIP_CONFIRM=1
    RETAIN_RELEASES=0
    BRANCH=main
    for helper in require_cmd acquire_release_lock load_runtime_env prepare_runtime_storage validate_server_actions_encryption_key ensure_clean_worktree ensure_unit_installed ensure_no_pm2_conflicts check_root_permissions_hint; do
      eval "${helper}() { :; }"
    done
    git() { printf 'main\n'; }
    systemctl() { printf 'systemctl %s\n' "$*" >> "${scenario_dir}/steps"; }
    sudo() { "$@"; }
    restore_systemd_units() { printf 'restore\n' >> "${scenario_dir}/steps"; }
    cleanup_old_releases() { return 1; }
    run_timed_step() {
      local name="$1"
      printf '%s\n' "${name}" >> "${scenario_dir}/steps"
      case "${name}" in
        "příprava deployment environmentu") GIT_HASH=111111111111 ;;
        "vytvoření staging workspace")
          RELEASE_BUILD_DIR="${RELEASES_DIR}/.staging.test"
          mkdir -p "${RELEASE_BUILD_DIR}"
          ;;
        "finalizace release workspace") shift; "$@" ;;
        build) [[ "${scenario}" != build-failure ]] ;;
        "runtime oprávnění release") [[ "${scenario}" != permissions-failure ]] ;;
        "aktivace release") [[ "${scenario}" != activation-failure ]] ;;
        *) return 0 ;;
      esac
    }
    run_release
  ) > "${scenario_dir}/output" 2>&1 &
  scenario_status=0
  wait "$!" || scenario_status=$?
  case "${scenario}" in
    build-failure|permissions-failure)
      [[ "${scenario_status}" -ne 0 ]]
      ! grep -q 'synchronizace systemd\|zastavení a ověření\|Prisma migrate deploy' "${scenario_dir}/steps"
      ;;
    activation-failure)
      [[ "${scenario_status}" -ne 0 ]]
      grep -q '^restore$' "${scenario_dir}/steps"
      grep -q '^systemctl stop ' "${scenario_dir}/steps"
      ;;
    cleanup-failure)
      [[ "${scenario_status}" -eq 0 ]]
      grep -q 'release je nasazený, ale úklid' "${scenario_dir}/output"
      ! grep -q '^restore$\|^systemctl stop ' "${scenario_dir}/steps"
      ;;
  esac
done

echo "Release regresní scénáře: OK"
