import assert from 'node:assert/strict';
import test from 'node:test';

test('MediaPicker vrací existující MediaAsset.id bez kopírování assetu', async () => {
  const { selectedMediaAssetId } = await import('./media-picker');
  assert.equal(selectedMediaAssetId('cmasset123'), 'cmasset123');
});
