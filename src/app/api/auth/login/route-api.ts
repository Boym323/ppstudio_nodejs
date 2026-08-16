import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminHomeHref } from "@/config/navigation";
import {
  authenticateAdmin,
  createSessionToken,
  getSessionCookie,
} from "@/lib/auth/session";
import {
  getAdminLoginAttemptMetadata,
  consumeAdminLoginRateLimit,
  normalizeAdminLoginEmail,
  releaseAdminLoginEmailReservation,
  writeAdminLoginAttemptLog,
} from "@/lib/auth/admin-login-rate-limit";
import { buildAbsoluteUrl, isSameOriginAdminRequest } from "@/lib/http/request-origin";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
  next: z.string().optional(),
});

type AdminLoginRouteDependencies = {
  authenticateAdmin: typeof authenticateAdmin;
  createSessionToken: typeof createSessionToken;
  getSessionCookie: typeof getSessionCookie;
  getAdminLoginAttemptMetadata: typeof getAdminLoginAttemptMetadata;
  consumeAdminLoginRateLimit: typeof consumeAdminLoginRateLimit;
  releaseAdminLoginEmailReservation: typeof releaseAdminLoginEmailReservation;
  normalizeAdminLoginEmail: typeof normalizeAdminLoginEmail;
  writeAdminLoginAttemptLog: typeof writeAdminLoginAttemptLog;
  buildAbsoluteUrl: typeof buildAbsoluteUrl;
  isSameOriginAdminRequest: typeof isSameOriginAdminRequest;
};

const defaultAdminLoginRouteDependencies: AdminLoginRouteDependencies = {
  authenticateAdmin,
  createSessionToken,
  getSessionCookie,
  getAdminLoginAttemptMetadata,
  consumeAdminLoginRateLimit,
  releaseAdminLoginEmailReservation,
  normalizeAdminLoginEmail,
  writeAdminLoginAttemptLog,
  buildAbsoluteUrl,
  isSameOriginAdminRequest,
};

function normalizeAdminLoginNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (
    !normalized ||
    !normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    !normalized.startsWith("/admin")
  ) {
    return undefined;
  }

  return normalized;
}

export function createAdminLoginRouteApi(
  dependencies: AdminLoginRouteDependencies = defaultAdminLoginRouteDependencies,
) {
  return {
    async POST(request: Request) {
      if (!dependencies.isSameOriginAdminRequest(request)) {
        return NextResponse.redirect(
          dependencies.buildAbsoluteUrl(request, "/admin/prihlaseni?error=origin_check_failed"),
          303,
        );
      }

      const formData = await request.formData();
      const normalizedEmail = dependencies.normalizeAdminLoginEmail(formData.get("email"));
      const loginAttemptMetadata = dependencies.getAdminLoginAttemptMetadata(
        request.headers,
        normalizedEmail,
      );

      const rateLimit = await dependencies.consumeAdminLoginRateLimit({
        ipHash: loginAttemptMetadata.ipHash,
        emailHash: loginAttemptMetadata.emailHash,
      });
      const { ipAttempts, emailFailures } = rateLimit;

      if (!rateLimit.allowed) {
        await dependencies.writeAdminLoginAttemptLog({
          loginOutcome: "RATE_LIMITED",
          ipHash: loginAttemptMetadata.ipHash,
          emailHash: loginAttemptMetadata.emailHash,
          userAgent: loginAttemptMetadata.userAgent,
          metadata: {
            ipAttempts,
            emailFailures,
          },
        });

        return NextResponse.redirect(
          dependencies.buildAbsoluteUrl(request, "/admin/prihlaseni?error=rate_limited"),
          303,
        );
      }

      const result = loginSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
        next: normalizeAdminLoginNextPath(formData.get("next")),
      });

      if (!result.success) {
        await dependencies.writeAdminLoginAttemptLog({
          loginOutcome: "INVALID_PAYLOAD",
          ipHash: loginAttemptMetadata.ipHash,
          emailHash: loginAttemptMetadata.emailHash,
          userAgent: loginAttemptMetadata.userAgent,
        });

        return NextResponse.redirect(
          dependencies.buildAbsoluteUrl(request, "/admin/prihlaseni?error=invalid_payload"),
          303,
        );
      }

      const authenticatedUser = await dependencies.authenticateAdmin(
        result.data.email,
        result.data.password,
      );

      if (!authenticatedUser) {
        await dependencies.writeAdminLoginAttemptLog({
          loginOutcome: "INVALID_CREDENTIALS",
          ipHash: loginAttemptMetadata.ipHash,
          emailHash: loginAttemptMetadata.emailHash,
          userAgent: loginAttemptMetadata.userAgent,
        });

        return NextResponse.redirect(
          dependencies.buildAbsoluteUrl(request, "/admin/prihlaseni?error=invalid_credentials"),
          303,
        );
      }

      await dependencies.releaseAdminLoginEmailReservation(rateLimit.emailReservationId);

      const token = await dependencies.createSessionToken({
        sub: authenticatedUser.id,
        email: authenticatedUser.email,
        name: authenticatedUser.name,
        role: authenticatedUser.role,
      });

      await dependencies.writeAdminLoginAttemptLog({
        loginOutcome: "SUCCESS",
        ipHash: loginAttemptMetadata.ipHash,
        emailHash: loginAttemptMetadata.emailHash,
        userAgent: loginAttemptMetadata.userAgent,
      });

      const response = NextResponse.redirect(
        dependencies.buildAbsoluteUrl(
          request,
          result.data.next ?? getAdminHomeHref(authenticatedUser.role),
        ),
        303,
      );

      const sessionCookie = dependencies.getSessionCookie();
      response.cookies.set(sessionCookie.name, token, sessionCookie.options);

      return response;
    },
  };
}
