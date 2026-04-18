#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SYSTEMD_DIR="/etc/systemd/system"
WEB_UNIT_NAME="ppstudio-web.service"
WORKER_UNIT_NAME="ppstudio-email-worker.service"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Spusť deploy.sh jako root, aby mohl zapsat do ${SYSTEMD_DIR}." >&2
  exit 1
fi

install_unit() {
  local source_file="$1"
  local target_file="$2"

  install -m 0644 "${source_file}" "${target_file}"
}

main() {
  if [[ ! -f "${REPO_DIR}/package.json" ]]; then
    echo "Nenašel jsem root projektu v ${REPO_DIR}." >&2
    exit 1
  fi

  install_unit "${REPO_DIR}/deploy/systemd/${WEB_UNIT_NAME}" "${SYSTEMD_DIR}/${WEB_UNIT_NAME}"
  install_unit "${REPO_DIR}/deploy/systemd/${WORKER_UNIT_NAME}" "${SYSTEMD_DIR}/${WORKER_UNIT_NAME}"

  systemctl daemon-reload
  systemctl enable --now "${WEB_UNIT_NAME%.service}"
  systemctl enable --now "${WORKER_UNIT_NAME%.service}"

  echo "Nasazeno:"
  echo "  - ${WEB_UNIT_NAME}"
  echo "  - ${WORKER_UNIT_NAME}"
}

main "$@"
