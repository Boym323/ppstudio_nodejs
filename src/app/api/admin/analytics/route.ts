import { createAdminAnalyticsRouteApi } from "./admin-analytics-route-api";

export const revalidate = 300;

const api = createAdminAnalyticsRouteApi();
export const GET = api.GET;
