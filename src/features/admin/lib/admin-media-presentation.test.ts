import assert from 'node:assert/strict';
import test from 'node:test';

import { hasCroppedMediaPlacement } from './admin-media-presentation';

test('náhled ořezu je určený jen médiím s veřejným místem používajícím ořez', () => {
  assert.equal(hasCroppedMediaPlacement([], []), false);
  assert.equal(hasCroppedMediaPlacement([{ source: 'MediaCollectionItem', recordId: 'certificate', field: 'CERTIFICATES' }], [{ type: 'CERTIFICATES', isVisible: true }]), false);
  assert.equal(hasCroppedMediaPlacement([{ source: 'MediaCollectionItem', recordId: 'reference', field: 'REFERENCES' }], [{ type: 'REFERENCES', isVisible: true }]), false);
  assert.equal(hasCroppedMediaPlacement([{ source: 'MediaCollectionItem', recordId: 'studio', field: 'STUDIO_GALLERY' }], [{ type: 'STUDIO_GALLERY', isVisible: false }]), false);
  assert.equal(hasCroppedMediaPlacement([{ source: 'MediaCollectionItem', recordId: 'studio', field: 'STUDIO_GALLERY' }], [{ type: 'STUDIO_GALLERY', isVisible: true }]), true);
  assert.equal(hasCroppedMediaPlacement([{ source: 'SiteSettings', recordId: 'site', field: 'contactPhotoMediaId' }], []), true);
  assert.equal(hasCroppedMediaPlacement([{ source: 'SiteSettings', recordId: 'site', field: 'homePortraitMediaId' }], []), true);
  assert.equal(hasCroppedMediaPlacement([{ source: 'SiteSettings', recordId: 'site', field: 'aboutPortraitMediaId' }], []), true);
  assert.equal(hasCroppedMediaPlacement([{ source: 'ServiceMedia', recordId: 'service-photo', field: 'HERO:Test:slug', serviceId: 'service' }], []), true);
});
