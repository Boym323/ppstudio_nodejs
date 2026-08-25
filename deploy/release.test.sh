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
validate_runtime_path "/var/lib/ppstudio" "test"

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
REPO_DIR="${saved_repo_dir}"
RELEASES_DIR="${saved_releases_dir}"

START_FAIL=""
CURL_FAIL=0
SUDO_RM_SEEN=0
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
MEDIA_STORAGE_ROOT="${REPO_DIR}"
if prepare_runtime_storage >/dev/null 2>&1; then
  echo "MEDIA_STORAGE_ROOT nesmí převzít checkout." >&2
  exit 1
fi
MEDIA_STORAGE_ROOT="${TEMP_DIR}/media"
prepare_runtime_storage
[[ "$(stat -c '%a' "${MEDIA_STORAGE_ROOT}")" == "750" ]]
chmod 0644 "${RELEASES_DIR}/new/package.json"
prepare_runtime_release "${RELEASES_DIR}/new"
[[ "$(stat -c '%a' "${RELEASES_DIR}/new/package.json")" == "640" ]]

systemctl() {
  case "$1" in
    start) [[ "${START_FAIL}" != "$2" ]] ;;
    stop|is-active|status|show) return 0 ;;
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

# Selhání webu, workeru a health/smoke musí vždy obnovit celý předchozí release.
START_FAIL="ppstudio-web"; expect_rollback
START_FAIL="ppstudio-email-worker"; expect_rollback
START_FAIL=""; CURL_FAIL=1; expect_rollback

# Typecheck, bezpečný test i build musí předcházet zápisu migrací a aktivaci; selhání quality gate tedy nemůže DB změnit.
typecheck_line="$(grep -n 'npm run typecheck' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
test_line="$(grep -n 'npm run test:release' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
build_line="$(grep -n 'npm run build' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
migrate_line="$(grep -n 'npx prisma migrate deploy (těsně' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
activate_line="$(grep -n 'activate_release "\${release_dir}"' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
[[ "${typecheck_line}" -lt "${test_line}" && "${test_line}" -lt "${build_line}" && "${build_line}" -lt "${migrate_line}" && "${migrate_line}" -lt "${activate_line}" ]]

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

echo "Release regresní scénáře: OK"
