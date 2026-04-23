export function formatObfuscatedEmail(email: string) {
  const [local, domain] = email.split('@');

  if (!local || !domain) {
    return email;
  }

  return `${local}(at)${domain}`;
}
