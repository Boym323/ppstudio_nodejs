type RequestLike = {
  headers: Headers;
  url: string;
};

function getFirstHeaderValue(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const first = value.split(",")[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function getForwardedOrigin(request: RequestLike): string | null {
  const forwardedHost = getFirstHeaderValue(request.headers.get("x-forwarded-host"));

  if (!forwardedHost) {
    return null;
  }

  const forwardedProto = getFirstHeaderValue(request.headers.get("x-forwarded-proto"));
  const protocol = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : "https";

  return `${protocol}://${forwardedHost}`;
}

export function buildAbsoluteUrl(request: RequestLike, pathname: string): URL {
  const origin = getForwardedOrigin(request) ?? new URL(request.url).origin;
  return new URL(pathname, origin);
}
