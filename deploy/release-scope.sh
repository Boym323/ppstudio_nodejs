#!/usr/bin/env bash
set -euo pipefail

# Běží až uvnitř scope, ještě před npm/Prisma/buildem. Přijetí vlastností
# systemdem samo nezaručuje, že je hostitel skutečně zapsal do cgroup.
fail() {
  echo "Release scope nemá ověřené limity: $*. Příkaz nebude spuštěn." >&2
  exit 1
}

[[ "$#" -ge 8 ]] || fail "chybí očekávané limity nebo příkaz"
unit_name="$1"
cpu_percent="${2%%%}"
memory_high="$3"
memory_max="$4"
tasks_max="$5"
cpu_weight="$6"
io_weight="$7"
shift 7

[[ "$(stat -f -c %T /sys/fs/cgroup)" == cgroup2fs ]] || fail "vyžaduje se cgroup v2 v /sys/fs/cgroup"
cgroup_path=""
while IFS=: read -r hierarchy controllers path; do
  if [[ "${hierarchy}" == 0 && -z "${controllers}" ]]; then
    cgroup_path="${path}"
    break
  fi
done < /proc/self/cgroup
[[ "${cgroup_path}" == /* && "${cgroup_path##*/}" == "${unit_name}.scope" ]] || fail "proces není v očekávaném scope"
[[ "/${cgroup_path}/" != */../* ]] || fail "cgroup cesta obsahuje nadřazený adresář"
cgroup_dir="/sys/fs/cgroup${cgroup_path}"

read_limit() {
  local value
  [[ -r "${cgroup_dir}/$1" ]] || fail "chybí controller nebo soubor $1"
  value="$(<"${cgroup_dir}/$1")"
  [[ "${value}" =~ ^[1-9][0-9]*$ ]] || fail "$1 nemá konečný kladný limit"
  printf '%s' "${value}"
}

[[ -r "${cgroup_dir}/cpu.max" ]] || fail "chybí cpu.max"
read -r quota period < "${cgroup_dir}/cpu.max"
[[ "${quota}" =~ ^[1-9][0-9]*$ && "${period}" =~ ^[1-9][0-9]*$ ]] || fail "cpu.max nemá konečnou kvótu"
(( quota * 100 <= cpu_percent * period )) || fail "cpu.max překračuje požadovanou kvótu"

# Přísnější limit je bezpečný; kernel může paměť zaokrouhlit dolů na stránky.
actual="$(read_limit memory.high)"
(( actual <= memory_high )) || fail "memory.high překračuje požadovaný limit"
actual="$(read_limit memory.max)"
(( actual <= memory_max )) || fail "memory.max překračuje požadovaný limit"
actual="$(read_limit pids.max)"
(( actual <= tasks_max )) || fail "pids.max překračuje požadovaný limit"
actual="$(read_limit cpu.weight)"
[[ "${actual}" == "${cpu_weight}" ]] || fail "cpu.weight neodpovídá požadavku"
[[ -r "${cgroup_dir}/io.weight" ]] || fail "chybí io.weight"
actual="$(<"${cgroup_dir}/io.weight")"
[[ "${actual}" == "default ${io_weight}" ]] || fail "io.weight neodpovídá požadavku"

exec "$@"
