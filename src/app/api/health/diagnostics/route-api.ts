import { AdminRole } from "@/generated/prisma/browser";
import type { AdminSession } from "@/lib/auth/session";

type ProtectedDiagnosticsDependencies = {
  getSession: () => Promise<AdminSession | null>;
  getDiagnostics: () => Promise<Response>;
};

export function createProtectedHealthDiagnosticsRoute(
  dependencies: ProtectedDiagnosticsDependencies,
) {
  return {
    GET: async () => {
      const session = await dependencies.getSession();

      if (!session) {
        return Response.json({ status: "unauthorized" }, { status: 401 });
      }

      if (session.role !== AdminRole.OWNER) {
        return Response.json({ status: "forbidden" }, { status: 403 });
      }

      return dependencies.getDiagnostics();
    },
  };
}
