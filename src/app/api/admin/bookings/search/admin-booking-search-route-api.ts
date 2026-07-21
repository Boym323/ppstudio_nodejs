import { AdminRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { formatClientPhoneForDisplay } from "@/features/booking/lib/client-phone";
import { getSession } from "@/lib/auth/session";
import { isSameOriginAdminRequest } from "@/lib/http/request-origin";
import { prisma } from "@/lib/prisma";

const bookingSearchSchema = z.object({
  query: z.string().trim().min(2).max(80),
});

const privateNoStoreHeaders = {
  "Cache-Control": "private, no-store",
};

type SearchSuggestion = {
  value: string;
  label: string;
  detail: string;
  kind: "client" | "contact" | "service";
};

export function createAdminBookingSearchRouteApi(deps?: {
  getSession?: typeof getSession;
  isSameOriginAdminRequest?: typeof isSameOriginAdminRequest;
  findClients?: typeof prisma.client.findMany;
  findServices?: typeof prisma.service.findMany;
}) {
  const getSessionImpl = deps?.getSession ?? getSession;
  const isSameOriginAdminRequestImpl = deps?.isSameOriginAdminRequest ?? isSameOriginAdminRequest;
  const findClientsImpl = deps?.findClients ?? prisma.client.findMany.bind(prisma.client);
  const findServicesImpl = deps?.findServices ?? prisma.service.findMany.bind(prisma.service);

  return {
    async POST(request: Request) {
      if (!isSameOriginAdminRequestImpl(request)) {
        return NextResponse.json(
          {
            status: "error",
            message: "Požadavek neprošel kontrolou původu.",
          },
          { status: 403, headers: privateNoStoreHeaders },
        );
      }

      const session = await getSessionImpl();
      if (!session || ![AdminRole.OWNER, AdminRole.SALON].includes(session.role)) {
        return NextResponse.json(
          {
            status: "error",
            message: "Do této sekce mají přístup jen přihlášení admin uživatelé.",
          },
          { status: 403, headers: privateNoStoreHeaders },
        );
      }

      const body = await request.json().catch(() => null);
      const parsed = bookingSearchSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          {
            status: "success",
            suggestions: [] satisfies SearchSuggestion[],
          },
          { status: 200, headers: privateNoStoreHeaders },
        );
      }

      const query = parsed.data.query;
      const contactLikeQuery = isContactLikeQuery(query);

      const [clients, services] = await Promise.all([
        findClientsImpl({
          where: {
            isActive: true,
            OR: contactLikeQuery
              ? [
                  { fullName: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query, mode: "insensitive" } },
                ]
              : [{ fullName: { contains: query, mode: "insensitive" } }],
          },
          orderBy: [{ lastBookedAt: "desc" }, { fullName: "asc" }],
          take: 6,
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        }),
        findServicesImpl({
          where: {
            isActive: true,
            name: { contains: query, mode: "insensitive" },
          },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          take: 5,
          select: {
            name: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        }),
      ]);

      const suggestions = new Map<string, SearchSuggestion>();

      const pushSuggestion = (suggestion: SearchSuggestion) => {
        if (suggestions.size >= 10) {
          return;
        }

        const key = `${suggestion.kind}:${suggestion.value.toLowerCase()}`;
        if (!suggestions.has(key)) {
          suggestions.set(key, suggestion);
        }
      };

      for (const client of clients) {
        pushSuggestion({
          kind: "client",
          value: client.fullName,
          label: client.fullName,
          detail: contactLikeQuery ? buildClientDetail(client.email, client.phone) : "Klientka",
        });

        if (contactLikeQuery && client.email) {
          pushSuggestion({
            kind: "contact",
            value: client.email,
            label: client.email,
            detail: `${client.fullName} · e-mail`,
          });
        }

        if (contactLikeQuery && client.phone) {
          const phoneLabel = formatClientPhoneForDisplay(client.phone);
          pushSuggestion({
            kind: "contact",
            value: phoneLabel,
            label: phoneLabel,
            detail: `${client.fullName} · telefon`,
          });
        }
      }

      for (const service of services) {
        pushSuggestion({
          kind: "service",
          value: service.name,
          label: service.name,
          detail: service.category.name,
        });
      }

      return NextResponse.json(
        {
          status: "success",
          suggestions: Array.from(suggestions.values()),
        },
        { status: 200, headers: privateNoStoreHeaders },
      );
    },
  };
}

function buildClientDetail(email: string | null, phone: string | null) {
  const parts: string[] = [];

  if (email) {
    parts.push(email);
  }

  if (phone) {
    parts.push(formatClientPhoneForDisplay(phone));
  }

  return parts.join(" · ") || "Klientka";
}

function isContactLikeQuery(query: string) {
  const normalized = query.trim();

  if (normalized.includes("@")) {
    return true;
  }

  const digits = normalized.replace(/\D/g, "");
  if (digits.length >= 3) {
    return true;
  }

  return /^[+()\d\s-]+$/.test(normalized);
}
