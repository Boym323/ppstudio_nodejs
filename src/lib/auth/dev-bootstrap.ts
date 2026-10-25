/** Offline bootstrap smí cílit jen na vyhrazenou DEV/test DB a testovací účet. */
export function assertDevBootstrapAllowed(environment: Record<string, string | undefined>) {
  if (environment.NODE_ENV !== "development" || environment.PPSTUDIO_DEV_BOOTSTRAP !== "1") {
    throw new Error("Bootstrap vyžaduje NODE_ENV=development a PPSTUDIO_DEV_BOOTSTRAP=1; na produkci je zakázaný.");
  }
  const url = new URL(environment.DATABASE_URL ?? "");
  const host = url.hostname;
  const isPrivateHost = ["localhost", "127.0.0.1", "[::1]"].includes(host)
    || /^10\.\d+\.\d+\.\d+$/.test(host)
    || /^192\.168\.\d+\.\d+$/.test(host)
    || /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (!isPrivateHost || !/^ppstudio(?:_[a-z0-9]+)*_(dev|test)$/.test(url.pathname.slice(1))) {
    throw new Error("Bootstrap je povolen pouze v privátní ppstudio *_dev nebo *_test databázi.");
  }
}

export const DEV_ADMIN_ID = "dev-bootstrap-planner-owner";
export const DEV_ADMIN_EMAIL = "dev-planner@example.test";
