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
  getRecentAdminLoginAttemptCounts,
  isAdminLoginRateLimited,
  normalizeAdminLoginEmail,
  writeAdminLoginAttemptLog,
} from "@/lib/auth/admin-login-rate-limit";
import { buildAbsoluteUrl } from "@/lib/http/request-origin";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

type AdminLoginRouteDependencies = {
  authenticateAdmin: typeof authenticateAdmin;
  createSessionToken: typeof createSessionToken;
  getSessionCookie: typeof getSessionCookie;
  getAdminLoginAttemptMetadata: typeof getAdminLoginAttemptMetadata;
  getRecentAdminLoginAttemptCounts: typeof getRecentAdminLoginAttemptCounts;
  isAdminLoginRateLimited: typeof isAdminLoginRateLimited;
  normalizeAdminLoginEmail: typeof normalizeAdminLoginEmail;
  writeAdminLoginAttemptLog: typeof writeAdminLoginAttemptLog;
  buildAbsoluteUrl: typeof buildAbsoluteUrl;
};

const defaultAdminLoginRouteDependencies: AdminLoginRouteDependencies = {
  authenticateAdmin,
  createSessionToken,
  getSessionCookie,
  getAdminLoginAttemptMetadata,
  getRecentAdminLoginAttemptCounts,
  isAdminLoginRateLimited,
  normalizeAdminLoginEmail,
  writeAdminLoginAttemptLog,
  buildAbsoluteUrl,
};

export function createAdminLoginRouteApi(
  dependencies: AdminLoginRouteDependencies = defaultAdminLoginRouteDependencies,
) {
  return {
    async POST(request: Request) {
      const formData = await request.formData();
      const normalizedEmail = dependencies.normalizeAdminLoginEmail(formData.get("email"));
      const loginAttemptMetadata = dependencies.getAdminLoginAttemptMetadata(
        request.headers,
        normalizedEmail,
      );

      const { ipAttempts, emailFailures } = await dependencies.getRecentAdminLoginAttemptCounts({
        ipHash: loginAttemptMetadata.ipHash,
        emailHash: loginAttemptMetadata.emailHash,
      });

      if (dependencies.isAdminLoginRateLimited({ ipAttempts, emailFailures })) {
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
        dependencies.buildAbsoluteUrl(request, getAdminHomeHref(authenticatedUser.role)),
        303,
      );

      const sessionCookie = dependencies.getSessionCookie();
      response.cookies.set(sessionCookie.name, token, sessionCookie.options);

      return response;
    },
  };
}

const adminLoginRouteApi = createAdminLoginRouteApi();

export const POST = adminLoginRouteApi.POST;
