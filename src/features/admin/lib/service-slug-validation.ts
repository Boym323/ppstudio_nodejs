export const SERVICE_SLUG_MAX_LENGTH = 80;
export const SERVICE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidServiceSlug(slug: string) {
  return slug.length > 0 && slug.length <= SERVICE_SLUG_MAX_LENGTH && SERVICE_SLUG_PATTERN.test(slug);
}

export function normalizeServiceSlugInput(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, SERVICE_SLUG_MAX_LENGTH)
    .replace(/-+$/, "");
}
