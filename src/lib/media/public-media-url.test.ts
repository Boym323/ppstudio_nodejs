import assert from 'node:assert/strict';
import test from 'node:test';
import { hasLocalMatch } from 'next/dist/shared/lib/match-local-pattern';

import nextConfig from '../../../next.config';

import { withPublicMediaCacheVersion } from './public-media-url';

test('verze veřejných médií obchází původní cache a zachovává query i fragment', () => {
  assert.equal(withPublicMediaCacheVersion('/media/public/images/a.jpg'), '/media/public/images/a.jpg?media-cache=2');
  assert.equal(withPublicMediaCacheVersion('/media/images/a.jpg?x=1#preview'), '/media/images/a.jpg?x=1&media-cache=2#preview');
  assert.equal(withPublicMediaCacheVersion('/media/images/a.jpg?media-cache=2'), '/media/images/a.jpg?media-cache=2');
  assert.equal(withPublicMediaCacheVersion('/logo.png'), '/logo.png');
  assert.equal(withPublicMediaCacheVersion('https://example.test/photo.jpg'), 'https://example.test/photo.jpg');
});

test('Next Image povoluje nové URL médií a zachovává statické i legacy obrázky', () => {
  assert.equal(nextConfig.images?.minimumCacheTTL, 0);
  const patterns = nextConfig.images?.localPatterns;
  for (const path of ['/media/public/images/2026/11/photo.jpg', '/media/images/2026/11/photo.jpg']) {
    assert.equal(hasLocalMatch(patterns, withPublicMediaCacheVersion(path)), true);
    assert.equal(hasLocalMatch(patterns, path), true);
  }
  assert.equal(hasLocalMatch(patterns, '/logo.png'), true);
  assert.equal(hasLocalMatch(patterns, '/logo.png?arbitrary=1'), false);
});
