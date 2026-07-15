#!/usr/bin/env bash
set -euo pipefail

# Izolované regresní scénáře release mechanismu; nespouštějí npm, Prisma ani systemd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/release.sh"

[[ "${RETAIN_RELEASES}" -eq 0 ]]

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

START_FAIL=""
CURL_FAIL=0
sudo() { "$@"; }
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

  if [[ "${*: -1}" == *"api/health" ]]; then
    if [[ -n "${output_file}" ]]; then
      printf '{"release":{"deploymentId":"%s"}}\n' "${NEXT_DEPLOYMENT_ID}" > "${output_file}"
    else
      printf '{"release":{"deploymentId":"%s"}}\n' "${NEXT_DEPLOYMENT_ID}"
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

# Typecheck i build musí předcházet zápisu migrací a aktivaci; selhání quality gate tedy nemůže DB změnit.
typecheck_line="$(grep -n 'npm run typecheck' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
build_line="$(grep -n 'npm run build' "${SCRIPT_DIR}/release.sh" | tail -1 | cut -d: -f1)"
migrate_line="$(grep -n 'npx prisma migrate deploy (těsně' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
activate_line="$(grep -n 'activate_release "\${release_dir}"' "${SCRIPT_DIR}/release.sh" | cut -d: -f1)"
[[ "${typecheck_line}" -lt "${build_line}" && "${build_line}" -lt "${migrate_line}" && "${migrate_line}" -lt "${activate_line}" ]]

# Výchozí úklid nikdy nesmí smazat current/previous ani ponechat další release.
for release in \
  111111111111-20260101000000 \
  222222222222-20260102000000 \
  333333333333-20260103000000 \
  444444444444-20260104000000; do
  mkdir -p "${RELEASES_DIR}/${release}"
done
set_release_link "${CURRENT_RELEASE_LINK}" "${RELEASES_DIR}/111111111111-20260101000000"
set_release_link "${PREVIOUS_RELEASE_LINK}" "${RELEASES_DIR}/222222222222-20260102000000"
RETAIN_RELEASES=0
cleanup_old_releases
[[ -d "${RELEASES_DIR}/111111111111-20260101000000" ]]
[[ -d "${RELEASES_DIR}/222222222222-20260102000000" ]]
[[ ! -d "${RELEASES_DIR}/444444444444-20260104000000" ]]
[[ ! -d "${RELEASES_DIR}/333333333333-20260103000000" ]]

echo "Release regresní scénáře: OK"
