import { AdminStatePill } from "@/features/admin/components/admin-state-pill";
import {
  getAccountStatusLabel,
  type AdminAccountStatus,
} from "@/features/admin/lib/admin-user-presentation";

function getStatusTone(status: AdminAccountStatus) {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "INVITED":
      return "accent";
    case "DISABLED":
    case "SYSTEM":
      return "muted";
  }
}

export function AccountStatusBadge({ status }: { status: AdminAccountStatus }) {
  return <AdminStatePill tone={getStatusTone(status)}>{getAccountStatusLabel(status)}</AdminStatePill>;
}
