import { AdminStatePill } from "@/features/admin/components/admin-state-pill";

export function ServiceStatusBadges({
  isActive,
  isPubliclyBookable,
  isEffectivelyVisible,
  compact = false,
}: {
  isActive: boolean;
  isPubliclyBookable: boolean;
  isEffectivelyVisible: boolean;
  compact?: boolean;
}) {
  const pillClassName = compact
    ? "px-2.5 py-0.5 text-[11px] normal-case tracking-normal"
    : "normal-case tracking-normal";

  return (
    <>
      <AdminStatePill tone={isActive ? "active" : "muted"} className={pillClassName}>
        {isActive ? "Aktivní" : "Neaktivní"}
      </AdminStatePill>
      <AdminStatePill tone={isPubliclyBookable ? "accent" : "muted"} className={pillClassName}>
        {isPubliclyBookable ? "Veřejná" : "Interní"}
      </AdminStatePill>
      {!isEffectivelyVisible ? (
        <AdminStatePill tone="muted" className={pillClassName}>
          Skrytá
        </AdminStatePill>
      ) : null}
    </>
  );
}
