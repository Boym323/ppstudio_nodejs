import { NextResponse } from "next/server";

import { getSessionCookie } from "@/lib/auth/session";
import { buildAbsoluteUrl } from "@/lib/http/request-origin";

export async function POST(request: Request) {
  const response = NextResponse.redirect(buildAbsoluteUrl(request, "/admin/prihlaseni"), 303);
  const sessionCookie = getSessionCookie();

  response.cookies.set(sessionCookie.name, "", {
    ...sessionCookie.options,
    maxAge: 0,
  });

  return response;
}
