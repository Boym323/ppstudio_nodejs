import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { buildAbsoluteUrl } from "@/lib/http/request-origin";

const ADMIN_LOGIN_PATH = "/admin/prihlaseni";
const ADMIN_INVITE_PATH_PREFIX = "/admin/pozvanka";
const SESSION_COOKIE = "ppstudio-admin-session";
const SESSION_SECRET = process.env.ADMIN_SESSION_SECRET;
const sessionSecretKey = SESSION_SECRET ? new TextEncoder().encode(SESSION_SECRET) : null;

async function hasValidSessionCookie(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !sessionSecretKey) {
    return false;
  }

  try {
    await jwtVerify(token, sessionSecretKey);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  if (pathname.startsWith(ADMIN_INVITE_PATH_PREFIX)) {
    return NextResponse.next();
  }

  const hasSession = await hasValidSessionCookie(request);

  if (!hasSession) {
    const loginPath = `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`;
    const response = NextResponse.redirect(buildAbsoluteUrl(request, loginPath));
    if (request.cookies.has(SESSION_COOKIE)) {
      response.cookies.delete(SESSION_COOKIE);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
