import { NextResponse } from "next/server";

import { getSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/admin/prihlaseni", request.url), 303);
  const sessionCookie = getSessionCookie();

  response.cookies.set(sessionCookie.name, "", {
    ...sessionCookie.options,
    maxAge: 0,
  });

  return response;
}
