import { isIP } from "node:net";

/**
 * Reads the client address supplied by the reverse proxy. The application must
 * only be reachable through that proxy, which overwrites X-Real-IP.
 */
export function getTrustedClientIp(requestHeaders: Headers) {
  const realIp = requestHeaders.get("x-real-ip")?.trim();

  return realIp && isIP(realIp) ? realIp : undefined;
}
