import assert from 'node:assert/strict';
import test from 'node:test';

import { getManagedCollectionCanonicalUrl, getMediaRedirectUrl, updateMediaMetadataSchema, updateMediaPublicationSchema } from './admin-media-validation';

test('schémata metadat a publikace přijímají nezávislé payloady', () => {
  assert.deepEqual(
    updateMediaMetadataSchema.parse({ area: 'owner', assetId: 'clh2g4m9e0000l7089a8z0x2b', title: 'Titulek', altText: 'Popis' }),
    { area: 'owner', assetId: 'clh2g4m9e0000l7089a8z0x2b', title: 'Titulek', altText: 'Popis' },
  );
  assert.deepEqual(
    updateMediaPublicationSchema.parse({ area: 'owner', assetId: 'clh2g4m9e0000l7089a8z0x2b', isPublished: 'true' }),
    { area: 'owner', assetId: 'clh2g4m9e0000l7089a8z0x2b', isPublished: true },
  );
});

test('managed collection odstraní knihovní parametry a zachová flash', () => {
  assert.equal(
    getManagedCollectionCanonicalUrl('owner', { collection: 'STUDIO_GALLERY', q: 'x', usage: 'USED', page: '2' }),
    '/admin/media?collection=STUDIO_GALLERY',
  );
  assert.equal(
    getManagedCollectionCanonicalUrl('salon', { collection: 'CERTIFICATES', q: 'x', usage: 'USED', publication: 'HIDDEN', page: '2', flash: 'media-upload-success' }),
    '/admin/provoz/media?collection=CERTIFICATES&flash=media-upload-success',
  );
  assert.equal(getManagedCollectionCanonicalUrl('owner', { collection: 'REFERENCES', q: 'x' }), null);
  assert.equal(getManagedCollectionCanonicalUrl('owner', { collection: 'CERTIFICATES' }), null);
});

test('redirect médií kanonizuje návrat do managed collection', () => {
  assert.equal(
    getMediaRedirectUrl('owner', '/admin/media?page=3&q=cert&usage=UNUSED&publication=HIDDEN&collection=CERTIFICATES', 'media-update-success'),
    '/admin/media?collection=CERTIFICATES&flash=media-update-success',
  );
});

test('redirect médií nahradí existující flash bez ztráty query parametrů', () => {
  assert.equal(
    getMediaRedirectUrl('salon', '/admin/provoz/media?q=cert&flash=old&page=3', 'media-delete-success'),
    '/admin/provoz/media?q=cert&flash=media-delete-success&page=3',
  );
});

test('redirect médií odmítne externí a protocol-relative URL', () => {
  for (const returnTo of ['https://example.com/admin/media', '//example.com/admin/media', 'admin/media']) {
    assert.equal(getMediaRedirectUrl('owner', returnTo, 'media-update-success'), '/admin/media?flash=media-update-success');
  }
});

test('redirect médií odmítne opačnou administrační oblast', () => {
  assert.equal(getMediaRedirectUrl('owner', '/admin/provoz/media?page=3', 'media-update-success'), '/admin/media?flash=media-update-success');
  assert.equal(getMediaRedirectUrl('salon', '/admin/media?page=3', 'media-update-success'), '/admin/provoz/media?flash=media-update-success');
});

test('redirect médií použije fallback při chybějícím nebo neplatném returnTo', () => {
  assert.equal(getMediaRedirectUrl('owner', undefined, 'media-update-success'), '/admin/media?flash=media-update-success');
  assert.equal(getMediaRedirectUrl('owner', '/admin/sluzby', 'media-update-success'), '/admin/media?flash=media-update-success');
});
