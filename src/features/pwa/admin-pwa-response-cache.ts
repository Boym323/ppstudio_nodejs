type CacheLike = Pick<Cache, "put">;

/**
 * Cache Storage must receive a clone before the browser starts consuming the
 * original response. Cache failures are deliberately non-fatal for the UI.
 */
export async function cachePwaResponseSafely(
  cache: CacheLike,
  request: Request,
  networkResponse: Response,
) {
  if (
    !networkResponse.ok ||
    networkResponse.type === "opaque" ||
    networkResponse.bodyUsed
  ) {
    return;
  }

  try {
    await cache.put(request, networkResponse.clone());
  } catch {
    // Caching is an optimization; a Cache Storage error must not fail the request.
  }
}
