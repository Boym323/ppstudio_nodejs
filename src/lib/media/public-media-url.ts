// Nový klíč obejde dříve vydané roční browserové i optimalizační cache.
// Uložené URL ani soubory se nemění.
export function withPublicMediaCacheVersion(url: string) {
  if (!url.startsWith('/media/')) return url;
  const versioned = new URL(url, 'https://media.example.test');
  versioned.searchParams.set('media-cache', '2');
  return `${versioned.pathname}${versioned.search}${versioned.hash}`;
}
