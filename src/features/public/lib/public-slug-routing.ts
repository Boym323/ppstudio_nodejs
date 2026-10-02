export type PublicSearchParams = Record<string, string | string[] | undefined>;

export function buildCanonicalBookingRedirectPath(
  searchParams: PublicSearchParams,
  canonicalServiceSlug: string,
) {
  const canonicalSearchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "service" || value === undefined) continue;

    for (const item of Array.isArray(value) ? value : [value]) {
      canonicalSearchParams.append(key, item);
    }
  }

  canonicalSearchParams.set("service", canonicalServiceSlug);
  return `/rezervace?${canonicalSearchParams.toString()}`;
}
