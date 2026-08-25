import { getSession } from "@/lib/auth/session";
import { createHealthDiagnosticsRouteApi } from "../route-api";
import { createProtectedHealthDiagnosticsRoute } from "./route-api";

const diagnostics = createHealthDiagnosticsRouteApi();

export const { GET } = createProtectedHealthDiagnosticsRoute({
  getSession,
  getDiagnostics: diagnostics.GET,
});
