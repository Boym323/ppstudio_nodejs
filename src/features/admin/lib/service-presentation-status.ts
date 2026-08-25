export type ServicePresentationStatus = "public" | "internal" | "inactive";

/**
 * Zjednodušený stav v administraci. Neaktivní služba může mít historicky
 * ponechaný příznak veřejné rezervovatelnosti; po opětovné aktivaci se tak
 * zachová její předchozí režim.
 */
export function getServicePresentationStatus(input: {
  isActive: boolean;
  isPubliclyBookable: boolean;
}): ServicePresentationStatus {
  if (!input.isActive) return "inactive";

  return input.isPubliclyBookable ? "public" : "internal";
}

export function applyServicePresentationStatus(
  current: { isActive: boolean; isPubliclyBookable: boolean },
  status: ServicePresentationStatus,
) {
  if (status === "public") return { isActive: true, isPubliclyBookable: true };
  if (status === "internal") return { isActive: true, isPubliclyBookable: false };

  return { isActive: false, isPubliclyBookable: current.isPubliclyBookable };
}

export const servicePresentationStatusLabels: Record<ServicePresentationStatus, string> = {
  public: "Veřejná",
  internal: "Interní",
  inactive: "Neaktivní",
};
