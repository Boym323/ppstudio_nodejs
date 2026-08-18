import { AdminRole, Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { isSameOriginAdminRequest } from "@/lib/http/request-origin";
import { prisma } from "@/lib/prisma";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(80),
});

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
};

export function createAdminClientSearchRouteApi(deps?: {
  getSession?: typeof getSession;
  isSameOriginAdminRequest?: typeof isSameOriginAdminRequest;
  findClients?: typeof prisma.client.findMany;
}) {
  const getSessionImpl = deps?.getSession ?? getSession;
  const isSameOriginAdminRequestImpl = deps?.isSameOriginAdminRequest ?? isSameOriginAdminRequest;
  const findClientsImpl = deps?.findClients ?? prisma.client.findMany.bind(prisma.client);

  return {
    async POST(request: Request) {
      if (!isSameOriginAdminRequestImpl(request)) {
        return NextResponse.json(
          { status: "error", message: "Požadavek neprošel kontrolou původu." },
          { status: 403, headers: privateNoStoreHeaders },
        );
      }

      const session = await getSessionImpl();
      if (!session || ![AdminRole.OWNER, AdminRole.SALON].includes(session.role)) {
        return NextResponse.json(
          { status: "error", message: "Přístup odepřen." },
          { status: 403, headers: privateNoStoreHeaders },
        );
      }

      if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
        return NextResponse.json(
          { status: "error", message: "Požadavek musí mít formát JSON." },
          { status: 415, headers: privateNoStoreHeaders },
        );
      }

      const body = await request.json().catch(() => null);
      const parsed = searchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { status: "success", clients: [] },
          { status: 200, headers: privateNoStoreHeaders },
        );
      }

      const query = parsed.data.query;
      const clients = await findClientsImpl({
        where: {
          isActive: true,
          OR: [
            { fullName: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { email: { contains: query, mode: Prisma.QueryMode.insensitive } },
            { phone: { contains: query, mode: Prisma.QueryMode.insensitive } },
          ],
        },
        orderBy: [{ lastBookedAt: "desc" }, { fullName: "asc" }, { id: "asc" }],
        take: 6,
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          internalNote: true,
          isActive: true,
        },
      });

      return NextResponse.json(
        {
          status: "success",
          clients: clients.map((client) => ({ ...client, email: client.email ?? "" })),
        },
        { status: 200, headers: privateNoStoreHeaders },
      );
    },
  };
}
