import { createAdminVoucherLookupRouteApi } from "./admin-voucher-lookup-route-api";

const routeApi = createAdminVoucherLookupRouteApi();

export async function POST(request: Request) {
  return routeApi.POST(request);
}
