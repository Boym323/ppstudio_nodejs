import { NextResponse } from "next/server";

import { createAdminClientSearchRouteApi } from "./admin-client-search-route-api";

const routeApi = createAdminClientSearchRouteApi();

export async function POST(request: Request) {
  return routeApi.POST(request);
}

export function GET() {
  return NextResponse.json(
    { status: "error", message: "Metoda není povolena." },
    { status: 405, headers: { Allow: "POST", "Cache-Control": "private, no-store" } },
  );
}
