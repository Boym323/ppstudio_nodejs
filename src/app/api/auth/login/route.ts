import { createAdminLoginRouteApi } from "./route-api";

const adminLoginRouteApi = createAdminLoginRouteApi();

export const POST = adminLoginRouteApi.POST;
