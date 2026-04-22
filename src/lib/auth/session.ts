import { AdminRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/config/env";
import { type AdminArea, getAdminHomeHref } from "@/config/navigation";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "ppstudio-admin-session";
const SESSION_MAX_AGE = 60 * 60 * 12;

const sessionSecret = new TextEncoder().encode(env.ADMIN_SESSION_SECRET);

type SessionPayload = {
  sub: string;
  email: string;
  name: string;
  role: AdminRole;
};

export type AdminSession = SessionPayload;

const bootstrapUsers = [
  {
    id: "bootstrap-owner",
    email: env.ADMIN_OWNER_EMAIL,
    password: env.ADMIN_OWNER_PASSWORD,
    name: "Majitel",
    role: AdminRole.OWNER,
  },
  {
    id: "bootstrap-staff",
    email: env.ADMIN_STAFF_EMAIL,
    password: env.ADMIN_STAFF_PASSWORD,
    name: "Provoz",
    role: AdminRole.SALON,
  },
] as const;

export type BootstrapAdminUser = (typeof bootstrapUsers)[number];

export async function authenticateAdmin(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const dbUser = await prisma.adminUser.findUnique({
    where: {
      email: normalizedEmail,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      passwordHash: true,
    },
  });

  if (dbUser?.passwordHash) {
    if (!dbUser.isActive) {
      return null;
    }

    const isPasswordValid = await verifyPassword(password, dbUser.passwordHash);

    if (!isPasswordValid) {
      return null;
    }

    await prisma.adminUser.update({
      where: {
        id: dbUser.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    };
  }

  const user = bootstrapUsers.find(
    (candidate) =>
      candidate.email.trim().toLowerCase() === normalizedEmail &&
      candidate.password === password,
  );

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(sessionSecret);
}

export async function verifySessionToken(token: string) {
  const { payload } = await jwtVerify(token, sessionSecret);

  return payload as SessionPayload;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

export async function requireSession() {
  const session = await getSession();

  if (!session) {
    redirect("/admin/prihlaseni");
  }

  return session;
}

export async function requireRole(allowedRoles: AdminRole[]) {
  const session = await requireSession();

  if (!allowedRoles.includes(session.role)) {
    redirect(getAdminHomeHref(session.role));
  }

  return session;
}

export async function requireAdminArea(area: AdminArea) {
  if (area === "owner") {
    return requireRole([AdminRole.OWNER]);
  }

  return requireRole([AdminRole.OWNER, AdminRole.SALON]);
}

export function listBootstrapAdminUsers(): BootstrapAdminUser[] {
  return [...bootstrapUsers];
}

export function getSessionCookie() {
  return {
    name: COOKIE_NAME,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    },
  };
}
