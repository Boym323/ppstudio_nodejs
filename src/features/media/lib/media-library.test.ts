import assert from 'node:assert/strict';
import test from 'node:test';

import { mapMediaAssetDeleteError } from './media-library';

test('P2003 při delete MediaAsset se rozpozná jako konflikt usage', () => {
  assert.equal((mapMediaAssetDeleteError({ code: 'P2003' }) as Error).message, 'MEDIA_ASSET_IN_USE');
  const originalError = new Error('MEDIA_ASSET_NOT_FOUND');
  assert.equal(mapMediaAssetDeleteError(originalError), originalError);
});
