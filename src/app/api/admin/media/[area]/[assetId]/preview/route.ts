import { createAdminMediaPreviewRouteApi } from '@/features/admin/lib/admin-media-preview-route-api';

const routeApi = createAdminMediaPreviewRouteApi();

export const GET = routeApi.GET;
