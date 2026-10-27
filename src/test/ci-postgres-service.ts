/**
 * GitHub Actions container jobs reach their isolated PostgreSQL service as "postgres".
 * Never broaden this exemption to arbitrary CI hosts or databases.
 */
export function isGitHubActionsPostgresServiceDatabase(
  target: URL,
  env: { CI?: string; GITHUB_ACTIONS?: string; GITHUB_REPOSITORY?: string },
) {
  return env.CI === "true"
    && env.GITHUB_ACTIONS === "true"
    && env.GITHUB_REPOSITORY === "Boym323/ppstudio_nodejs"
    && target.hostname === "postgres"
    && target.port === "5432"
    && target.username === "postgres"
    && decodeURIComponent(target.pathname) === "/ppstudio"
    && (target.searchParams.get("schema") ?? "public") === "public";
}
