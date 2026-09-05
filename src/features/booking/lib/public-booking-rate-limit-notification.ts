export function selectPublicBookingRateLimitNotificationSource({
  ipRateLimitAllowed,
  ipHash,
  emailHash,
}: {
  ipRateLimitAllowed: boolean;
  ipHash?: string;
  emailHash?: string;
}) {
  const limitedByIp = !ipRateLimitAllowed;

  return {
    sourceHash: limitedByIp ? ipHash : emailHash,
    sourceKind: limitedByIp ? ("ip" as const) : ("email" as const),
  };
}
