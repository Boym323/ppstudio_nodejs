import { AdminStatePill } from "@/features/admin/components/admin-state-pill";

export function ServiceStatusBadges({
  isActive,
  isPubliclyBookable,
  isEffectivelyVisible,
  compact = false,
  showHiddenState = true,
}: {
  isActive: boolean;
  isPubliclyBookable: boolean;
  isEffectivelyVisible: boolean;
  compact?: boolean;
  showHiddenState?: boolean;
}) {
  const pillClassName = compact
    ? "px-2.5 py-0.5 text-[11px] normal-case tracking-normal"
    : "normal-case tracking-normal";

  return (
    <>
      <AdminStatePill
        tone={isActive ? "active" : "muted"}
        className={pillClassName}
        title={
          isActive
            ? "Aktivní: služba je provozně zapnutá v katalogu."
            : "Neaktivní: služba je vypnutá pro běžný provoz, ale zůstává v evidenci a historii."
        }
      >
        {isActive ? "Aktivní" : "Neaktivní"}
      </AdminStatePill>
      <AdminStatePill
        tone={isPubliclyBookable ? "accent" : "muted"}
        className={pillClassName}
        title={
          isPubliclyBookable
            ? "Veřejná: služba se může nabízet klientce na webu a v booking flow."
            : "Interní: služba je jen pro interní práci a klientka ji sama nevybere."
        }
      >
        {isPubliclyBookable ? "Veřejná" : "Interní"}
      </AdminStatePill>
      {showHiddenState && !isEffectivelyVisible ? (
        <AdminStatePill
          tone="muted"
          className={pillClassName}
          title="Skrytá: služba je mimo veřejné zobrazení kvůli svému stavu nebo stavu kategorie."
        >
          Skrytá
        </AdminStatePill>
      ) : null}
    </>
  );
}
