const ADMIN_REDIRECT_PATH_PATTERN = /^\/admin(?:$|[/?])/;
const ENCODED_REDIRECT_SEPARATOR_PATTERN = /%(?:2f|5c|3a)/i;

export function getSafeAdminRedirectPath(value: string | undefined, fallback: string) {
  if (
    !value
    || !ADMIN_REDIRECT_PATH_PATTERN.test(value)
    || value.startsWith("//")
    || value.includes("\\")
    || /[\u0000-\u001f\u007f]/.test(value)
    || ENCODED_REDIRECT_SEPARATOR_PATTERN.test(value)
  ) {
    return fallback;
  }

  return value;
}
