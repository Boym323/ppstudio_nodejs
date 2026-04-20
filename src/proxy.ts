import { NextResponse, type NextRequest } from "next/server";
import { buildAbsoluteUrl } from "@/lib/http/request-origin";

const ADMIN_LOGIN_PATH = "/admin/prihlaseni";
const SESSION_COOKIE = "ppstudio-admin-session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession) {
    const loginPath = `${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(buildAbsoluteUrl(request, loginPath));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
