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

export async function POST(request: Request) {
  const formData = await request.formData();
  const normalizedEmail = normalizeAdminLoginEmail(formData.get("email"));
  const loginAttemptMetadata = getAdminLoginAttemptMetadata(request.headers, normalizedEmail);

  const { ipAttempts, emailFailures } = await getRecentAdminLoginAttemptCounts({
    ipHash: loginAttemptMetadata.ipHash,
    emailHash: loginAttemptMetadata.emailHash,
  });

  if (isAdminLoginRateLimited({ ipAttempts, emailFailures })) {
    await writeAdminLoginAttemptLog({
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
      buildAbsoluteUrl(request, "/admin/prihlaseni?error=rate_limited"),
      303,
    );
  }

  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    await writeAdminLoginAttemptLog({
      loginOutcome: "INVALID_PAYLOAD",
      ipHash: loginAttemptMetadata.ipHash,
      emailHash: loginAttemptMetadata.emailHash,
      userAgent: loginAttemptMetadata.userAgent,
    });

    return NextResponse.redirect(
      buildAbsoluteUrl(request, "/admin/prihlaseni?error=invalid_payload"),
      303,
    );
  }

  const authenticatedUser = await authenticateAdmin(result.data.email, result.data.password);

  if (!authenticatedUser) {
    await writeAdminLoginAttemptLog({
      loginOutcome: "INVALID_CREDENTIALS",
      ipHash: loginAttemptMetadata.ipHash,
      emailHash: loginAttemptMetadata.emailHash,
      userAgent: loginAttemptMetadata.userAgent,
    });

    return NextResponse.redirect(
      buildAbsoluteUrl(request, "/admin/prihlaseni?error=invalid_credentials"),
      303,
    );
  }

  const token = await createSessionToken({
    sub: authenticatedUser.id,
    email: authenticatedUser.email,
    name: authenticatedUser.name,
    role: authenticatedUser.role,
  });

  await writeAdminLoginAttemptLog({
    loginOutcome: "SUCCESS",
    ipHash: loginAttemptMetadata.ipHash,
    emailHash: loginAttemptMetadata.emailHash,
    userAgent: loginAttemptMetadata.userAgent,
  });

  const response = NextResponse.redirect(
    buildAbsoluteUrl(request, getAdminHomeHref(authenticatedUser.role)),
    303,
  );

  const sessionCookie = getSessionCookie();
  response.cookies.set(sessionCookie.name, token, sessionCookie.options);

  return response;
}
