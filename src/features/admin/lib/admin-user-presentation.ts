import { AdminRole } from "@prisma/client";

export type AdminAccountStatus = "ACTIVE" | "INVITED" | "DISABLED" | "SYSTEM";

export function getAdminRoleLabel(role: AdminRole) {
  return role === AdminRole.OWNER ? "OWNER" : "SALON";
}

export function getAccountStatusLabel(status: AdminAccountStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Aktivní";
    case "INVITED":
      return "Pozvánka čeká";
    case "DISABLED":
      return "Deaktivovaný";
    case "SYSTEM":
      return "Systémový účet";
  }

  return String(status);
}
