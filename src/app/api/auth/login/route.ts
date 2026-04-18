import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminHomeHref } from "@/config/navigation";
import {
  authenticateAdmin,
  createSessionToken,
  getSessionCookie,
} from "@/lib/auth/session";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const formData = await request.formData();

  const result = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!result.success) {
    return NextResponse.redirect(
      new URL("/admin/prihlaseni?error=invalid_payload", request.url),
      303,
    );
  }

  const authenticatedUser = await authenticateAdmin(result.data.email, result.data.password);

  if (!authenticatedUser) {
    return NextResponse.redirect(
      new URL("/admin/prihlaseni?error=invalid_credentials", request.url),
      303,
    );
  }

  const token = await createSessionToken({
    sub: authenticatedUser.id,
    email: authenticatedUser.email,
    name: authenticatedUser.name,
    role: authenticatedUser.role,
  });

  const response = NextResponse.redirect(
    new URL(getAdminHomeHref(authenticatedUser.role), request.url),
    303,
  );

  const sessionCookie = getSessionCookie();
  response.cookies.set(sessionCookie.name, token, sessionCookie.options);

  return response;
}
