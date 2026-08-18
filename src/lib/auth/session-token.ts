import type { AdminRole } from "@/generated/prisma/browser";
import { SignJWT, jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "ppstudio-admin-session";
const DEFAULT_SESSION_IDLE_MAX_AGE = 60 * 60 * 24 * 14;
const DEFAULT_SESSION_REFRESH_WINDOW = 60 * 60 * 24 * 2;
const DEFAULT_SESSION_ABSOLUTE_MAX_AGE = 60 * 60 * 24 * 45;

type SessionTokenPayload = {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
  sessionStartedAt?: number;
};

type SessionTokenClaims = SessionTokenPayload & {
  exp?: number;
  iat?: number;
};

type CreateSessionTokenOptions = {
  nowEpochSeconds?: number;
  sessionStartedAt?: number;
};

function readOptionalPositiveIntegerEnv(name: string) {
  const rawValue = process.env[name];
  if (!rawValue || rawValue.trim().length === 0) {
    return undefined;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${name} must be a positive integer value in seconds.`);
  }

  return parsedValue;
}

const SESSION_IDLE_MAX_AGE =
  readOptionalPositiveIntegerEnv("ADMIN_SESSION_IDLE_MAX_AGE_SECONDS") ??
  DEFAULT_SESSION_IDLE_MAX_AGE;
const SESSION_REFRESH_WINDOW =
  readOptionalPositiveIntegerEnv("ADMIN_SESSION_REFRESH_WINDOW_SECONDS") ??
  DEFAULT_SESSION_REFRESH_WINDOW;
const SESSION_ABSOLUTE_MAX_AGE =
  readOptionalPositiveIntegerEnv("ADMIN_SESSION_ABSOLUTE_MAX_AGE_SECONDS") ??
  DEFAULT_SESSION_ABSOLUTE_MAX_AGE;

if (SESSION_REFRESH_WINDOW > SESSION_IDLE_MAX_AGE) {
  throw new Error(
    "ADMIN_SESSION_REFRESH_WINDOW_SECONDS must be less than or equal to ADMIN_SESSION_IDLE_MAX_AGE_SECONDS.",
  );
}

if (SESSION_ABSOLUTE_MAX_AGE < SESSION_IDLE_MAX_AGE) {
  throw new Error(
    "ADMIN_SESSION_ABSOLUTE_MAX_AGE_SECONDS must be greater than or equal to ADMIN_SESSION_IDLE_MAX_AGE_SECONDS.",
  );
}

function getSessionSecretKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SessionTokenPayload,
  options: CreateSessionTokenOptions = {},
) {
  const nowEpochSeconds = options.nowEpochSeconds ?? Math.floor(Date.now() / 1000);
  const sessionStartedAt = options.sessionStartedAt ?? payload.sessionStartedAt ?? nowEpochSeconds;

  return new SignJWT({
    ...payload,
    sessionStartedAt,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt(nowEpochSeconds)
    .setExpirationTime(nowEpochSeconds + SESSION_IDLE_MAX_AGE)
    .sign(getSessionSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionTokenClaims> {
  const { payload } = await jwtVerify(token, getSessionSecretKey());
  return payload as SessionTokenClaims;
}

export function shouldRefreshSessionToken(
  claims: Pick<SessionTokenClaims, "exp" | "iat" | "sessionStartedAt">,
  nowEpochSeconds: number,
) {
  if (!claims.exp) {
    return false;
  }

  const sessionStartedAt = claims.sessionStartedAt ?? claims.iat ?? nowEpochSeconds;
  if (nowEpochSeconds - sessionStartedAt >= SESSION_ABSOLUTE_MAX_AGE) {
    return false;
  }

  return claims.exp - nowEpochSeconds <= SESSION_REFRESH_WINDOW;
}

export function shouldRejectSessionForAbsoluteAge(
  claims: Pick<SessionTokenClaims, "iat" | "sessionStartedAt">,
  nowEpochSeconds: number,
) {
  const sessionStartedAt = claims.sessionStartedAt ?? claims.iat;
  if (!sessionStartedAt) {
    return false;
  }
  return nowEpochSeconds - sessionStartedAt >= SESSION_ABSOLUTE_MAX_AGE;
}

export function getSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_IDLE_MAX_AGE,
    },
  };
}

export {
  SESSION_ABSOLUTE_MAX_AGE,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_MAX_AGE,
  SESSION_REFRESH_WINDOW,
};
export type { SessionTokenClaims, SessionTokenPayload };
