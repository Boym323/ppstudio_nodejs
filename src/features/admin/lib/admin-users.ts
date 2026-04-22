import "server-only";

import { AdminRole } from "@prisma/client";

import { isMissingInvitedAtColumnError } from "@/features/admin/lib/admin-user-db";
import { type AdminAccountStatus } from "@/features/admin/lib/admin-user-presentation";
import { listBootstrapAdminUsers } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const formatDate = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const formatDateTime = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export type AdminUserAccessRecord = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AdminAccountStatus;
  isSystem: boolean;
  helperText: string;
  summary: string;
  invitedAtLabel: string | null;
  lastLoginAtLabel: string | null;
  createdAtLabel: string;
  canEdit: boolean;
  canChangeRole: boolean;
  canDeactivate: boolean;
  canActivate: boolean;
  canResendInvite: boolean;
};

export type AdminUsersPageData = {
  stats: Array<{
    label: string;
    value: string;
    tone?: "default" | "accent" | "muted";
    detail?: string;
  }>;
  users: AdminUserAccessRecord[];
  roleCards: Array<{
    role: AdminRole;
    title: string;
    description: string;
    bullets: string[];
  }>;
};

function formatDateLabel(value: Date | null | undefined) {
  if (!value) {
    return null;
  }

  return formatDate.format(value);
}

function formatDateTimeLabel(value: Date | null | undefined) {
  if (!value) {
    return null;
  }

  return formatDateTime.format(value);
}

function deriveDbStatus(user: {
  isActive: boolean;
  invitedAt: Date | null;
  lastLoginAt: Date | null;
  passwordHash: string | null;
}): AdminAccountStatus {
  if (!user.isActive) {
    return "DISABLED";
  }

  if (user.invitedAt && !user.lastLoginAt && !user.passwordHash) {
    return "INVITED";
  }

  return "ACTIVE";
}

function getHelperText(role: AdminRole, status: AdminAccountStatus, isSystem: boolean) {
  if (isSystem) {
    return "Tento účet je spravovaný systémově a nelze ho běžně upravovat.";
  }

  if (status === "INVITED") {
    return "Pozvánka je připravená a čeká na dokončení přístupu.";
  }

  if (status === "DISABLED") {
    return "Účet je vypnutý a v přehledu zůstává jen pro evidenci.";
  }

  return role === AdminRole.OWNER
    ? "Plný přístup do celé administrace a správy provozu."
    : "Běžný provozní přístup pro každodenní práci v salonu.";
}

function getSummary(user: {
  status: AdminAccountStatus;
  invitedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  isSystem: boolean;
}) {
  if (user.isSystem) {
    return "Spravovaný přístup pro bezpečný vstup do administrace.";
  }

  if (user.status === "INVITED") {
    return user.invitedAt
      ? `Pozvánka založená ${formatDateTimeLabel(user.invitedAt)}`
      : `Pozvánka založená ${formatDateLabel(user.createdAt)}`;
  }

  if (user.status === "DISABLED") {
    return `Účet založený ${formatDateLabel(user.createdAt)}`;
  }

  return user.lastLoginAt
    ? `Poslední přihlášení ${formatDateTimeLabel(user.lastLoginAt)}`
    : `Účet založený ${formatDateLabel(user.createdAt)}`;
}

export async function getAdminUsersPageData(): Promise<AdminUsersPageData> {
  const [dbUsers, systemUsers] = await Promise.all([
    loadAdminUsers(),
    Promise.resolve(listBootstrapAdminUsers()),
  ]);

  const dbRecords: AdminUserAccessRecord[] = dbUsers.map((user) => {
    const status = deriveDbStatus(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status,
      isSystem: false,
      helperText: getHelperText(user.role, status, false),
      summary: getSummary({
        status,
        invitedAt: user.invitedAt,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        isSystem: false,
      }),
      invitedAtLabel: formatDateTimeLabel(user.invitedAt),
      lastLoginAtLabel: formatDateTimeLabel(user.lastLoginAt),
      createdAtLabel: formatDateTimeLabel(user.createdAt) ?? "Bez data",
      canEdit: true,
      canChangeRole: true,
      canDeactivate: status !== "DISABLED",
      canActivate: status === "DISABLED",
      canResendInvite: status === "INVITED",
    };
  });

  const systemRecords: AdminUserAccessRecord[] = systemUsers.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: "SYSTEM",
    isSystem: true,
    helperText: getHelperText(user.role, "SYSTEM", true),
    summary: "Spravovaný přístup pro nouzový nebo základní provozní vstup.",
    invitedAtLabel: null,
    lastLoginAtLabel: null,
    createdAtLabel: "Spravováno mimo běžnou správu uživatelů",
    canEdit: false,
    canChangeRole: false,
    canDeactivate: false,
    canActivate: false,
    canResendInvite: false,
  }));

  const users = [...dbRecords, ...systemRecords];

  return {
    stats: [
      {
        label: "Aktivní přístupy",
        value: String(users.filter((user) => user.status === "ACTIVE").length),
        tone: "accent",
        detail: "Běžně používané účty připravené pro práci v administraci.",
      },
      {
        label: "Pozvánky čekají",
        value: String(users.filter((user) => user.status === "INVITED").length),
        detail: "Nově připravené přístupy, které ještě nejsou dokončené.",
      },
      {
        label: "Deaktivované",
        value: String(users.filter((user) => user.status === "DISABLED").length),
        tone: "muted",
        detail: "Účty ponechané v evidenci bez běžného použití.",
      },
      {
        label: "Systémové účty",
        value: String(users.filter((user) => user.status === "SYSTEM").length),
        tone: "muted",
        detail: "Read-only přístupy spravované systémově mimo běžnou úpravu.",
      },
    ],
    users,
    roleCards: [
      {
        role: AdminRole.OWNER,
        title: "OWNER",
        description: "Plný přístup do celé administrace.",
        bullets: [
          "Správa uživatelů, nastavení a provozních sekcí",
          "Přístup k e-mailovým logům a dalším owner-only částem",
        ],
      },
      {
        role: AdminRole.SALON,
        title: "SALON",
        description: "Každodenní práce v salonu bez přístupu do citlivých sekcí.",
        bullets: [
          "Rezervace, dostupnosti, klienti, služby a certifikáty",
          "Bez přístupu do uživatelů, nastavení a e-mailových logů",
        ],
      },
    ],
  };
}

async function loadAdminUsers() {
  try {
    return await prisma.adminUser.findMany({
      orderBy: [{ role: "asc" }, { isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        invitedAt: true,
        lastLoginAt: true,
        createdAt: true,
        passwordHash: true,
      },
    });
  } catch (error) {
    if (!isMissingInvitedAtColumnError(error)) {
      throw error;
    }

    const legacyUsers = await prisma.adminUser.findMany({
      orderBy: [{ role: "asc" }, { isActive: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    return legacyUsers.map((user) => ({
      ...user,
      invitedAt: null,
    }));
  }
}
