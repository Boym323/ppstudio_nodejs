import { createAdminBookingSearchRouteApi } from "./admin-booking-search-route-api";

const routeApi = createAdminBookingSearchRouteApi();

export async function POST(request: Request) {
  return routeApi.POST(request);
}
