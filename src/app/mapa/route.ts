import { NextResponse } from "next/server";

const clientStudioMapTargetUrl = "https://maps.app.goo.gl/iRdsWbiX99fw3Q36A";

export function GET() {
  return NextResponse.redirect(clientStudioMapTargetUrl, 302);
}
