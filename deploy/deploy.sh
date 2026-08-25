#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
SYSTEMD_DIR="/etc/systemd/system"
WEB_UNIT_NAME="ppstudio-web.service"
WORKER_UNIT_NAME="ppstudio-email-worker.service"
SYSUSERS_FILE="ppstudio.sysusers.conf"
TMPFILES_FILE="ppstudio.tmpfiles.conf"

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

  # První provisioning ještě nemá verzovaný release. Zachováme proto dosavadní
  # checkout jako dočasný cíl; první release.sh ho nahradí adresářem v releases/.
  if [[ ! -e "${REPO_DIR}/current" ]]; then
    ln -s "${REPO_DIR}" "${REPO_DIR}/current"
  fi

  install -m 0644 "${REPO_DIR}/deploy/systemd/${SYSUSERS_FILE}" "/etc/sysusers.d/${SYSUSERS_FILE}"
  systemd-sysusers "/etc/sysusers.d/${SYSUSERS_FILE}"
  install -m 0644 "${REPO_DIR}/deploy/systemd/${TMPFILES_FILE}" "/etc/tmpfiles.d/${TMPFILES_FILE}"
  systemd-tmpfiles --create "/etc/tmpfiles.d/${TMPFILES_FILE}"

  # První provisioning může dočasně spouštět checkout přes current. Runtime
  # účet proto dostane jen čtení/traversal; tajný env není čitelný ostatními.
  chgrp -R ppstudio "${REPO_DIR}"
  chmod -R g+rX,o-rwx "${REPO_DIR}"
  if [[ -d "${REPO_DIR}/.next/cache" ]]; then
    chmod -R g+rwX "${REPO_DIR}/.next/cache"
  fi
  if [[ -f "${REPO_DIR}/.env" ]]; then
    chgrp ppstudio "${REPO_DIR}/.env"
    chmod 0640 "${REPO_DIR}/.env"
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
