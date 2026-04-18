const BASE_RETRY_DELAY_MS = 30_000;
const MAX_RETRY_DELAY_MS = 15 * 60 * 1000;

export function getEmailDeliveryRetryDelayMs(attemptCount: number) {
  const safeAttemptCount = Math.max(1, attemptCount);
  const backoff = BASE_RETRY_DELAY_MS * 2 ** (safeAttemptCount - 1);

  return Math.min(backoff, MAX_RETRY_DELAY_MS);
}

export function getMaxEmailDeliveryAttempts() {
  return 5;
}
