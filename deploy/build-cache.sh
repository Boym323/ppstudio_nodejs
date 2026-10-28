#!/usr/bin/env bash

# Persistentní Turbopack/SWC cache pro release helper. Načítá se z release.sh
# po původních helper funkcích, aby zůstalo zachováno veřejné rozhraní testů.

build_cache_environment_id() {
  local environment_id="${PPSTUDIO_BUILD_CACHE_ENV_ID:-production}"

  if [[ ! "${environment_id}" =~ ^[A-Za-z0-9._-]{1,64}$ ]]; then
    echo "PPSTUDIO_BUILD_CACHE_ENV_ID obsahuje nepovolené znaky." >&2
    return 1
  fi
  printf '%s\n' "${environment_id}"
}

build_cache_root() {
  printf '%s/.build-cache\n' "${RELEASES_DIR}"
}

build_cache_seed_worktree_root() {
  printf '%s/.build-cache-worktree\n' "${RELEASES_DIR}"
}

build_cache_generation_source_commit() {
  node - "$1/metadata.json" <<'NODE'
const { readFileSync } = require('node:fs');
let commit;
try {
  commit = JSON.parse(readFileSync(process.argv[2], 'utf8')).sourceCommit;
} catch {
  process.exit(1);
}
if (typeof commit !== 'string' || !/^[0-9a-f]{40}$/.test(commit)) process.exit(1);
console.log(commit);
NODE
}

ensure_build_cache_seed_worktree() {
  local seed_worktree="$(build_cache_seed_worktree_root)"

  if [[ -L "${seed_worktree}" || ( -e "${seed_worktree}" && ! -d "${seed_worktree}" ) ]]; then
    echo "Seed worktree kompilační cache má nebezpečný typ cesty: ${seed_worktree}." >&2
    return 1
  fi
  if [[ ! -e "${seed_worktree}" ]]; then
    git -C "${REPO_DIR}" worktree add --detach "${seed_worktree}" HEAD >/dev/null
  fi
  [[ -f "${seed_worktree}/.git" ]] || return 1
  if [[ -L "${seed_worktree}/.next" || ( -e "${seed_worktree}/.next" && ! -d "${seed_worktree}/.next" ) ]] \
    || [[ -L "${seed_worktree}/.next/cache" || ( -e "${seed_worktree}/.next/cache" && ! -d "${seed_worktree}/.next/cache" ) ]]; then
    echo "Seed worktree kompilační cache má nebezpečný .next typ cesty." >&2
    return 1
  fi
  chmod 0700 "${seed_worktree}"
  mkdir -p "${seed_worktree}/.next/cache"
  chmod 0700 "${seed_worktree}/.next" "${seed_worktree}/.next/cache"
}

replace_seed_cache_tree() {
  local source_tree="$1"
  local target_tree="$2"
  local target_parent
  local temporary_tree
  local backup_tree="${target_tree}.old.$$"

  validate_cache_tree "${source_tree}" || return 1
  target_parent="$(dirname "${target_tree}")"
  [[ ! -L "${target_parent}" && ! -L "${target_tree}" && ! -e "${backup_tree}" ]] || return 1
  temporary_tree="$(mktemp -d -p "${target_parent}" '.cache-seed.XXXXXX')"
  if ! cp -R --no-preserve=ownership "${source_tree}" "${temporary_tree}/tree"; then
    safe_remove_cache_path "${temporary_tree}" "${target_parent}" || true
    return 1
  fi
  chmod -R go-rwx "${temporary_tree}/tree"
  if [[ -e "${target_tree}" ]]; then
    mv -T -- "${target_tree}" "${backup_tree}" || {
      safe_remove_cache_path "${temporary_tree}" "${target_parent}" || true
      return 1
    }
  fi
  if ! mv -T -- "${temporary_tree}/tree" "${target_tree}"; then
    if [[ -e "${backup_tree}" ]]; then mv -T -- "${backup_tree}" "${target_tree}" || true; fi
    safe_remove_cache_path "${temporary_tree}" "${target_parent}" || true
    return 1
  fi
  rmdir "${temporary_tree}" 2>/dev/null || true
  if [[ -e "${backup_tree}" ]]; then
    safe_remove_cache_path "${backup_tree}" "${target_parent}" || return 1
  fi
}

sync_build_cache_seed_worktree() {
  local generation_dir="$1"
  local seed_worktree="$(build_cache_seed_worktree_root)"
  local cache_name
  local source_commit

  source_commit="$(build_cache_generation_source_commit "${generation_dir}")" || return 1
  ensure_build_cache_seed_worktree || return 1
  # Turbopack must compare the new staging checkout with the exact Git revision
  # that produced the seeded compilation cache, not an older arbitrary HEAD.
  if [[ "$(git -C "${seed_worktree}" rev-parse HEAD)" != "${source_commit}" ]]; then
    git -C "${seed_worktree}" reset --hard "${source_commit}" >/dev/null || return 1
  fi
  for cache_name in turbopack swc; do
    if [[ -d "${generation_dir}/${cache_name}" ]]; then
      replace_seed_cache_tree "${generation_dir}/${cache_name}" "${seed_worktree}/.next/cache/${cache_name}" || return 1
    fi
  done
}

clear_build_cache_seed_worktree() {
  local seed_worktree="$(build_cache_seed_worktree_root)"
  local cache_name

  [[ -f "${seed_worktree}/.git" ]] || return 0
  for cache_name in turbopack swc; do
    if [[ -e "${seed_worktree}/.next/cache/${cache_name}" ]]; then
      safe_remove_cache_path "${seed_worktree}/.next/cache/${cache_name}" "${seed_worktree}/.next/cache" || return 1
    fi
  done
}

ensure_build_cache_root() {
  local cache_root="$(build_cache_root)"
  local generations_dir="${cache_root}/generations"

  mkdir -p "${RELEASES_DIR}"
  if [[ -L "${cache_root}" || ( -e "${cache_root}" && ! -d "${cache_root}" ) ]]; then
    echo "Kompilační cache má nebezpečný typ cesty: ${cache_root}." >&2
    return 1
  fi
  if [[ -L "${generations_dir}" || ( -e "${generations_dir}" && ! -d "${generations_dir}" ) ]]; then
    echo "Adresář generací kompilační cache má nebezpečný typ cesty: ${generations_dir}." >&2
    return 1
  fi
  mkdir -p "${generations_dir}"
  chmod 0700 "${cache_root}" "${generations_dir}"
}

validate_cache_tree() {
  local tree_path="$1"

  [[ -d "${tree_path}" && ! -L "${tree_path}" ]] || return 1
  if find -P "${tree_path}" \( -type l -o ! \( -type f -o -type d \) \) -print -quit | grep -q .; then
    echo "Kompilační cache obsahuje symlink nebo nepovolený typ souboru: ${tree_path}." >&2
    return 1
  fi
}

compute_build_cache_key() {
  BUILD_CACHE_KEY="$(BUILD_CACHE_FORMAT_VERSION="${BUILD_CACHE_FORMAT_VERSION:-2}" node <<'NODE'
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');

const hash = createHash('sha256');
const update = (label, value) => {
  hash.update(label);
  hash.update('\0');
  hash.update(value);
  hash.update('\0');
};

update('format', process.env.BUILD_CACHE_FORMAT_VERSION);
update('node', JSON.stringify({ versions: process.versions, platform: process.platform, arch: process.arch }));
update('npm', execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim());

for (const file of [
  'package.json',
  'package-lock.json',
  'next.config.ts',
  'src/config/security-headers.ts',
  'prisma/schema.prisma',
  'prisma.config.ts',
  'tsconfig.json',
]) {
  if (existsSync(file)) update(`file:${file}`, readFileSync(file));
}

const deploymentIdentity = new Set(['NEXT_DEPLOYMENT_ID', 'DEPLOYMENT_VERSION', 'GIT_HASH']);
if (existsSync('.env')) {
  const dotenvEntries = [];
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/);
    if (match && !deploymentIdentity.has(match[1])) dotenvEntries.push([match[1], match[2]]);
  }
  update('dotenv', JSON.stringify(dotenvEntries.sort(([left], [right]) => left.localeCompare(right))));
}
const buildEnvironment = Object.entries(process.env)
  .filter(([key]) => key === 'NODE_ENV'
    || key === 'NEXT_TELEMETRY_DISABLED'
    || key === 'PPSTUDIO_NEXT_DIST_DIR'
    || key === 'PPSTUDIO_DISABLE_TURBOPACK_CACHE'
    || key.startsWith('NEXT_PUBLIC_'))
  .filter(([key]) => !deploymentIdentity.has(key))
  .sort(([left], [right]) => left.localeCompare(right));
update('build-environment', JSON.stringify(buildEnvironment));

console.log(hash.digest('hex'));
NODE
)"
}

write_build_cache_metadata() {
  local generation_dir="$1"
  local environment_id="$2"
  local source_commit

  source_commit="$(git -C "${REPO_DIR}" rev-parse HEAD)" || return 1
  BUILD_CACHE_SOURCE_COMMIT="${source_commit}" \
  BUILD_CACHE_FORMAT_VERSION="${BUILD_CACHE_FORMAT_VERSION:-2}" \
  BUILD_CACHE_KEY="${BUILD_CACHE_KEY}" \
  BUILD_CACHE_ENV_ID="${environment_id}" \
  node - "${generation_dir}" <<'NODE'
const { createHash } = require('node:crypto');
const { lstatSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');

const generationDir = path.resolve(process.argv[2]);
const entries = [];

function walk(current, relative) {
  const stat = lstatSync(current);
  if (stat.isSymbolicLink()) throw new Error(`symlink: ${relative}`);
  if (stat.isDirectory()) {
    for (const name of readdirSync(current).sort()) walk(path.join(current, name), path.join(relative, name));
    return;
  }
  if (!stat.isFile()) throw new Error(`unsupported file: ${relative}`);
  entries.push({
    path: relative.split(path.sep).join('/'),
    bytes: stat.size,
    sha256: createHash('sha256').update(readFileSync(current)).digest('hex'),
  });
}

for (const name of ['turbopack', 'swc']) {
  const cachePath = path.join(generationDir, name);
  try {
    if (lstatSync(cachePath).isDirectory()) walk(cachePath, name);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

if (entries.length === 0) throw new Error('empty compilation cache');
writeFileSync(path.join(generationDir, 'metadata.json'), `${JSON.stringify({
  formatVersion: Number(process.env.BUILD_CACHE_FORMAT_VERSION),
  environment: process.env.BUILD_CACHE_ENV_ID,
  key: process.env.BUILD_CACHE_KEY,
  sourceCommit: process.env.BUILD_CACHE_SOURCE_COMMIT,
  entries,
})}\n`, { mode: 0o600 });
NODE
  chmod 0600 "${generation_dir}/metadata.json"
}

validate_build_cache_generation() {
  local generation_dir="$1"
  local environment_id="$2"

  [[ -d "${generation_dir}" && ! -L "${generation_dir}" ]] || return 1
  if [[ -e "${generation_dir}/turbopack" ]]; then
    validate_cache_tree "${generation_dir}/turbopack" || return 1
  fi
  if [[ -e "${generation_dir}/swc" ]]; then
    validate_cache_tree "${generation_dir}/swc" || return 1
  fi
  [[ ! -L "${generation_dir}/metadata.json" && -f "${generation_dir}/metadata.json" ]] || return 1
  BUILD_CACHE_FORMAT_VERSION="${BUILD_CACHE_FORMAT_VERSION:-2}" \
  BUILD_CACHE_KEY="${BUILD_CACHE_KEY}" \
  BUILD_CACHE_ENV_ID="${environment_id}" \
  node - "${generation_dir}" <<'NODE'
const { createHash } = require('node:crypto');
const { lstatSync, readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');

const generationDir = path.resolve(process.argv[2]);
let metadata;
try {
  metadata = JSON.parse(readFileSync(path.join(generationDir, 'metadata.json'), 'utf8'));
} catch {
  process.exit(1);
}
if (metadata.formatVersion !== Number(process.env.BUILD_CACHE_FORMAT_VERSION)
  || metadata.environment !== process.env.BUILD_CACHE_ENV_ID
  || metadata.key !== process.env.BUILD_CACHE_KEY
  || typeof metadata.sourceCommit !== 'string'
  || !/^[0-9a-f]{40}$/.test(metadata.sourceCommit)
  || !Array.isArray(metadata.entries)
  || metadata.entries.length === 0) process.exit(1);

const listed = new Set();
for (const entry of metadata.entries) {
  if (typeof entry.path !== 'string'
    || !/^(turbopack|swc)\/[A-Za-z0-9._/-]+$/.test(entry.path)
    || entry.path.includes('..')
    || listed.has(entry.path)) process.exit(1);
  let stat;
  try {
    stat = lstatSync(path.join(generationDir, entry.path));
  } catch {
    process.exit(1);
  }
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== entry.bytes) process.exit(1);
  const digest = createHash('sha256').update(readFileSync(path.join(generationDir, entry.path))).digest('hex');
  if (digest !== entry.sha256) process.exit(1);
  listed.add(entry.path);
}

const actual = new Set();
function collect(current, relative) {
  let stat;
  try {
    stat = lstatSync(current);
  } catch {
    process.exit(1);
  }
  if (stat.isSymbolicLink()) process.exit(1);
  if (stat.isDirectory()) {
    for (const name of readdirSync(current).sort()) collect(path.join(current, name), path.join(relative, name));
    return;
  }
  if (!stat.isFile()) process.exit(1);
  actual.add(relative.split(path.sep).join('/'));
}
for (const name of ['turbopack', 'swc']) {
  const cachePath = path.join(generationDir, name);
  try {
    if (lstatSync(cachePath).isDirectory()) collect(cachePath, name);
  } catch (error) {
    if (error.code !== 'ENOENT') process.exit(1);
  }
}
if (actual.size !== listed.size || [...actual].some((entry) => !listed.has(entry))) process.exit(1);
NODE
}

safe_remove_cache_path() {
  local path_to_remove="$1"
  local expected_parent="$2"
  local resolved_path

  [[ -n "${path_to_remove}" && -n "${expected_parent}" && ! -L "${path_to_remove}" ]] || return 1
  resolved_path="$(readlink -m -- "${path_to_remove}")" || return 1
  expected_parent="$(readlink -m -- "${expected_parent}")" || return 1
  [[ "${resolved_path}" == "${expected_parent}"/* ]] || return 1
  rm -rf -- "${path_to_remove}"
}

prune_build_cache() {
  local cache_root="$(build_cache_root)"
  local generations_dir="${cache_root}/generations"
  local current_target=""
  local generation_dir
  local generation_name
  local generation_index=0
  local generation_bytes
  local max_generations="${PPSTUDIO_BUILD_CACHE_MAX_GENERATIONS:-2}"
  local max_bytes="${PPSTUDIO_BUILD_CACHE_MAX_BYTES:-1073741824}"
  local total_bytes=0

  [[ "${max_generations}" =~ ^[1-9][0-9]*$ && "${max_bytes}" =~ ^[1-9][0-9]*$ ]] || {
    echo "Limity kompilační cache musí být kladná celá čísla." >&2
    return 1
  }
  if [[ -L "${cache_root}/current" ]]; then
    current_target="$(readlink -f -- "${cache_root}/current")" || return 1
  fi

  while IFS= read -r -d '' generation_dir; do
    generation_name="$(basename "${generation_dir}")"
    [[ "${generation_name}" =~ ^[0-9a-f]{16}-[0-9]{23}-[0-9a-f]{16}$ ]] || continue
    generation_dir="$(readlink -f -- "${generation_dir}")" || return 1
    [[ "$(dirname "${generation_dir}")" == "$(readlink -f -- "${generations_dir}")" ]] || return 1
    generation_index=$((generation_index + 1))
    generation_bytes="$(du -sb -- "${generation_dir}" | cut -f1)"
    if [[ "${generation_dir}" == "${current_target}" ]]; then
      total_bytes=$((total_bytes + generation_bytes))
      continue
    fi
    if (( generation_index > max_generations || total_bytes + generation_bytes > max_bytes )); then
      safe_remove_cache_path "${generation_dir}" "${generations_dir}" || return 1
      continue
    fi
    total_bytes=$((total_bytes + generation_bytes))
  done < <(find -P "${generations_dir}" -mindepth 1 -maxdepth 1 -type d -printf '%p\0' | sort -z -r)
}

restore_build_cache() {
  if [[ "${USE_BUILD_CACHE}" -ne 1 ]]; then
    export PPSTUDIO_DISABLE_TURBOPACK_CACHE=1
    return 0
  fi
  unset PPSTUDIO_DISABLE_TURBOPACK_CACHE
  local cache_root="$(build_cache_root)"
  local generation_dir
  local cache_name
  local environment_id

  environment_id="$(build_cache_environment_id)" || return 1
  compute_build_cache_key
  BUILD_CACHE_RESTORED=0
  BUILD_CACHE_RECOVERY_ATTEMPTED=0
  ensure_build_cache_root || return 1

  if [[ ! -L "${cache_root}/current" ]]; then
    clear_build_cache_seed_worktree || return 1
    log "Kompilační cache chybí; build začne bez cache."
    return 0
  fi
  generation_dir="$(readlink -f -- "${cache_root}/current")" || {
    clear_build_cache_seed_worktree || return 1
    log "Kompilační cache má neplatný odkaz; build začne bez cache."
    return 0
  }
  if [[ "$(dirname "${generation_dir}")" != "$(readlink -f -- "${cache_root}/generations")" ]] \
    || ! validate_build_cache_generation "${generation_dir}" "${environment_id}"; then
    clear_build_cache_seed_worktree || return 1
    log "Kompilační cache je neplatná nebo poškozená; build začne bez její obnovy."
    return 0
  fi

  if [[ -f .git ]]; then
    if sync_build_cache_seed_worktree "${generation_dir}"; then
      BUILD_CACHE_RESTORED=1
      log "Kompilační cache připravena pro Turbopack seed (prostředí ${environment_id})."
      return 0
    fi
    clear_build_cache_seed_worktree || return 1
    log "Seed worktree kompilační cache není dostupný; build začne bez cache."
    return 0
  fi

  if [[ -L .next || -L .next/cache ]]; then
    echo "Staging workspace má nebezpečný symlink v .next/cache." >&2
    return 1
  fi
  mkdir -p .next/cache
  for cache_name in turbopack swc; do
    if [[ -d "${generation_dir}/${cache_name}" ]]; then
      validate_cache_tree "${generation_dir}/${cache_name}" || return 1
      [[ ! -L ".next/cache/${cache_name}" ]] || return 1
      cp -R --no-preserve=ownership "${generation_dir}/${cache_name}" ".next/cache/${cache_name}"
      chmod -R go-rwx ".next/cache/${cache_name}"
    fi
  done
  BUILD_CACHE_RESTORED=1
  log "Kompilační cache obnovena (prostředí ${environment_id})."
}

save_build_cache() {
  [[ "${USE_BUILD_CACHE}" -eq 1 ]] || return 0
  local cache_root="$(build_cache_root)"
  local generations_dir="${cache_root}/generations"
  local generation_id
  local generation_dir
  local temporary_dir
  local cache_name
  local environment_id
  local pointer_tmp="${cache_root}/current.new.$$"

  environment_id="$(build_cache_environment_id)" || return 1
  [[ -n "${BUILD_CACHE_KEY}" ]] || compute_build_cache_key
  ensure_build_cache_root || return 1
  if [[ -e "${cache_root}/current" && ! -L "${cache_root}/current" ]]; then
    echo "Kompilační cache má nebezpečný current pointer." >&2
    return 1
  fi

  # Nanoseconds preserve chronological pruning order; random bytes prevent
  # collisions even for multiple saves in one process within one timestamp.
  generation_id="${BUILD_CACHE_KEY:0:16}-$(date -u +%Y%m%d%H%M%S%N)-$(node -p 'require("node:crypto").randomBytes(8).toString("hex")')"
  generation_dir="${generations_dir}/${generation_id}"
  temporary_dir="$(mktemp -d -p "${generations_dir}" '.staging.XXXXXX')"
  chmod 0700 "${temporary_dir}"

  for cache_name in turbopack swc; do
    if [[ -e ".next/cache/${cache_name}" ]]; then
      validate_cache_tree ".next/cache/${cache_name}" || {
        safe_remove_cache_path "${temporary_dir}" "${generations_dir}" || true
        return 1
      }
      cp -R --no-preserve=ownership ".next/cache/${cache_name}" "${temporary_dir}/${cache_name}" || {
        safe_remove_cache_path "${temporary_dir}" "${generations_dir}" || true
        return 1
      }
      chmod -R go-rwx "${temporary_dir}/${cache_name}"
    fi
  done

  if ! write_build_cache_metadata "${temporary_dir}" "${environment_id}"; then
    safe_remove_cache_path "${temporary_dir}" "${generations_dir}" || true
    return 1
  fi
  if ! mv -T -- "${temporary_dir}" "${generation_dir}"; then
    safe_remove_cache_path "${temporary_dir}" "${generations_dir}" || true
    return 1
  fi
  ln -s "generations/${generation_id}" "${pointer_tmp}"
  if ! mv -Tf -- "${pointer_tmp}" "${cache_root}/current"; then
    unlink "${pointer_tmp}" 2>/dev/null || true
    safe_remove_cache_path "${generation_dir}" "${generations_dir}" || true
    return 1
  fi
  if [[ -f .git ]] && ! sync_build_cache_seed_worktree "${generation_dir}"; then
    echo "Kompilační cache byla uložena, ale seed worktree se nepodařilo aktualizovat." >&2
    return 1
  fi
  prune_build_cache || return 1
  log "Kompilační cache atomicky uložena (${generation_id})."
}

remove_restored_build_cache() {
  local cache_name

  for cache_name in turbopack swc; do
    if [[ -e ".next/cache/${cache_name}" ]]; then
      safe_remove_cache_path ".next/cache/${cache_name}" ".next/cache" || return 1
    fi
  done
}

build_failure_is_cache_corruption() {
  [[ -n "${BUILD_CACHE_FAILURE_LOG}" && -f "${BUILD_CACHE_FAILURE_LOG}" ]] || return 1
  grep -Eiq 'Failed to restore task data|failed to restore task data|corrupt(ed|ion)?|invalid.*cache|cache.*invalid|missing.*\.sst|\.sst.*(missing|not found)|unexpected end of (file|json)' "${BUILD_CACHE_FAILURE_LOG}"
}

run_build_command() {
  local build_status

  BUILD_CACHE_FAILURE_LOG="$(mktemp)"
  set +e
  npm --ignore-scripts run build 2>&1 | tee "${BUILD_CACHE_FAILURE_LOG}"
  build_status=${PIPESTATUS[0]}
  set -e
  return "${build_status}"
}

run_build_with_cache_recovery() {
  local build_status

  if run_build_command; then
    unlink "${BUILD_CACHE_FAILURE_LOG}" 2>/dev/null || true
    BUILD_CACHE_FAILURE_LOG=""
    return 0
  else
    build_status=$?
  fi
  if [[ "${BUILD_CACHE_RESTORED}" -eq 1 && "${BUILD_CACHE_RECOVERY_ATTEMPTED}" -eq 0 ]] \
    && build_failure_is_cache_corruption; then
    BUILD_CACHE_RECOVERY_ATTEMPTED=1
    log "Build nahlásil známou chybu persistentní cache; mažu pouze její kopii ve stagingu a opakuji jeden čistý build."
    remove_restored_build_cache || return 1
    unlink "${BUILD_CACHE_FAILURE_LOG}" 2>/dev/null || true
    BUILD_CACHE_FAILURE_LOG=""
    # Git worktree builds seed from the persistent .build-cache-worktree, not
    # only .next/cache. Disable both sources for this single clean retry.
    if PPSTUDIO_DISABLE_TURBOPACK_CACHE=1 run_build_command; then
      unlink "${BUILD_CACHE_FAILURE_LOG}" 2>/dev/null || true
      BUILD_CACHE_FAILURE_LOG=""
      return 0
    else
      build_status=$?
    fi
  fi
  unlink "${BUILD_CACHE_FAILURE_LOG}" 2>/dev/null || true
  BUILD_CACHE_FAILURE_LOG=""
  return "${build_status}"
}
