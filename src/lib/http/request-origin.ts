type RequestLike = {
  headers: Headers;
  url: string;
};

const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function getFirstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function normalizeHost(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const host = value.trim().toLowerCase().replace(/\.$/, "");
  return host.length > 0 ? host : null;
}

function normalizeDomainHost(value: string | null | undefined): string | null {
  const normalized = normalizeHost(value);

  if (!normalized) {
    return null;
  }

  try {
    return normalizeHost(
      normalized.startsWith("http://") || normalized.startsWith("https://")
        ? new URL(normalized).host
        : normalized.replace(/\/.*$/, ""),
    );
  } catch {
    return null;
  }
}

function getConfiguredAppOrigin() {
  return new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
}

function getConfiguredAppHost() {
  return normalizeDomainHost(process.env.NEXT_PUBLIC_APP_URL);
}

function getAllowedHosts() {
  const hosts = new Set<string>();

  for (const host of [
    normalizeDomainHost(process.env.NEXT_PUBLIC_APP_URL),
    normalizeDomainHost(process.env.NEXT_PUBLIC_SITE_DOMAIN),
    normalizeDomainHost(process.env.VOUCHER_PUBLIC_DOMAIN),
  ]) {
    if (host) {
      hosts.add(host);
      const alias = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
      if (alias.length > 0) {
        hosts.add(alias);
      }
    }
  }

  return hosts;
}

function isTrustedHost(host: string | null) {
  if (!host) {
    return false;
  }

  if (getAllowedHosts().has(host)) {
    return true;
  }

  let hostname = host;

  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    hostname = host;
  }

  return process.env.NODE_ENV !== "production" && LOCAL_DEVELOPMENT_HOSTS.has(hostname);
}

function getForwardedOrigin(request: RequestLike): string | null {
  const forwardedHost = normalizeHost(getFirstHeaderValue(request.headers.get("x-forwarded-host")));

  if (!isTrustedHost(forwardedHost)) {
    return null;
  }

  const forwardedProto = getFirstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";

  return `${protocol}://${forwardedHost}`;
}

export function buildAbsoluteUrl(request: RequestLike, pathname: string): URL {
  const requestUrl = new URL(request.url);
  const requestHost = normalizeHost(requestUrl.host);
  const origin =
    getForwardedOrigin(request) ??
    (isTrustedHost(requestHost) ? requestUrl.origin : getConfiguredAppOrigin());

  return new URL(pathname, origin);
}

export function isSameOriginAdminRequest(request: RequestLike) {
  const configuredOrigin = getConfiguredAppOrigin();
  const configuredHost = getConfiguredAppHost();
  const originHeader = request.headers.get("origin");
  const hostHeader = normalizeHost(
    getFirstHeaderValue(request.headers.get("x-forwarded-host"))
    ?? request.headers.get("host"),
  );

  if (!configuredHost || !hostHeader) {
    return false;
  }

  const configuredHostAliases = new Set<string>([
    configuredHost,
    configuredHost.startsWith("www.") ? configuredHost.slice(4) : `www.${configuredHost}`,
  ]);

  if (!configuredHostAliases.has(hostHeader)) {
    return false;
  }

  if (!originHeader) {
    return false;
  }

  try {
    return new URL(originHeader).origin === configuredOrigin;
  } catch {
    return false;
  }
}
