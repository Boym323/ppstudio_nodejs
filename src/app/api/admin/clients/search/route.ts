import { AdminRole, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(80),
});

export async function GET(request: Request) {
  const session = await getSession();

  if (!session || ![AdminRole.OWNER, AdminRole.SALON].includes(session.role)) {
    return NextResponse.json({ status: "error", message: "Přístup odepřen." }, { status: 403 });
  }

  const parsed = searchSchema.safeParse({ query: new URL(request.url).searchParams.get("query") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ status: "success", clients: [] });
  }

  const query = parsed.data.query;
  const clients = await prisma.client.findMany({
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

  return NextResponse.json({
    status: "success",
    clients: clients.map((client) => ({ ...client, email: client.email ?? "" })),
  });
}
