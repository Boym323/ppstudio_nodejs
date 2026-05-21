import { AdminRole } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/config/env";
import { type AdminArea, getAdminHomeHref } from "@/config/navigation";
import { verifyPassword } from "@/lib/auth/password";
import {
  createSessionToken as createSessionTokenInternal,
  getSessionCookie as getSessionCookieConfig,
  verifySessionToken as verifySessionTokenInternal,
  type SessionTokenPayload,
} from "@/lib/auth/session-token";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = getSessionCookieConfig().name;

type SessionPayload = SessionTokenPayload;

export type AdminSession = SessionPayload;

export type BootstrapAdminUser = {
  id: "bootstrap-owner" | "bootstrap-staff";
  email: string;
  password: string;
  name: string;
  role: AdminRole;
};

function getBootstrapUsers(): BootstrapAdminUser[] {
  return [
    {
      id: "bootstrap-owner",
      email: process.env.ADMIN_OWNER_EMAIL ?? env.ADMIN_OWNER_EMAIL,
      password: process.env.ADMIN_OWNER_PASSWORD ?? env.ADMIN_OWNER_PASSWORD,
      name: "Majitel",
      role: AdminRole.OWNER,
    },
    {
      id: "bootstrap-staff",
      email: process.env.ADMIN_STAFF_EMAIL ?? env.ADMIN_STAFF_EMAIL,
      password: process.env.ADMIN_STAFF_PASSWORD ?? env.ADMIN_STAFF_PASSWORD,
      name: "Provoz",
      role: AdminRole.SALON,
    },
  ];
}

function isBootstrapAdminLoginEnabled() {
  return process.env.ADMIN_BOOTSTRAP_ENABLED === "true" || env.ADMIN_BOOTSTRAP_ENABLED === "true";
}

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

  if (!isBootstrapAdminLoginEnabled()) {
    return null;
  }

  const user = getBootstrapUsers().find(
    (candidate) =>
      candidate.email.trim().toLowerCase() === normalizedEmail &&
      candidate.password === password,
  );

  if (!user) {
    return null;
  }

  console.warn("Bootstrap admin login used", {
    role: user.role,
    mode: "recovery",
  });

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function createSessionToken(payload: SessionPayload) {
  return createSessionTokenInternal(payload);
}

export async function verifySessionToken(token: string) {
  return verifySessionTokenInternal(token);
}

export async function resolveSessionFromTokenValue(token: string): Promise<AdminSession | null> {
  let tokenPayload: SessionPayload;

  try {
    tokenPayload = await verifySessionToken(token);
  } catch {
    return null;
  }

  if (!tokenPayload.sub || tokenPayload.sub.startsWith("bootstrap-")) {
    return null;
  }

  const dbUser = await prisma.adminUser.findUnique({
    where: {
      id: tokenPayload.sub,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  });

  if (!dbUser?.isActive) {
    return null;
  }

  return {
    sub: dbUser.id,
    email: dbUser.email,
    name: dbUser.name,
    role: dbUser.role,
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return resolveSessionFromTokenValue(token);
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
  return getBootstrapUsers();
}

export function getSessionCookie() {
  return getSessionCookieConfig();
}
