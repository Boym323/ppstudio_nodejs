import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addReferenceMediaSchema,
  moveReferenceMediaSchema,
  removeReferenceMediaSchema,
  updateReferenceMediaSchema,
} from './reference-media-validation';

const cuid = 'clh2g4m9e0000l7089a8z0x2b';

test('validní add payload projde a identifikátor odpovídá cuid formátu', () => {
  assert.deepEqual(
    addReferenceMediaSchema.parse({ area: 'owner', mediaAssetId: cuid }),
    { area: 'owner', mediaAssetId: cuid },
  );
  assert.equal(addReferenceMediaSchema.safeParse({ area: 'owner', mediaAssetId: '' }).success, false);
  assert.equal(addReferenceMediaSchema.safeParse({ area: 'studio', mediaAssetId: cuid }).success, false);
});

test('move povoluje pouze up a down a odmítá neplatné id', () => {
  assert.equal(moveReferenceMediaSchema.safeParse({ area: 'salon', id: cuid, direction: 'up' }).success, true);
  assert.equal(moveReferenceMediaSchema.safeParse({ area: 'salon', id: cuid, direction: 'down' }).success, true);
  assert.equal(moveReferenceMediaSchema.safeParse({ area: 'salon', id: cuid, direction: 'left' }).success, false);
  assert.equal(moveReferenceMediaSchema.safeParse({ area: 'salon', id: 'not-an-id', direction: 'up' }).success, false);
});

test('update trimuje metadata, normalizuje prázdné hodnoty a hlídá limity', () => {
  assert.deepEqual(
    updateReferenceMediaSchema.parse({
      area: 'owner',
      id: cuid,
      isVisible: ['false', 'true'],
      altText: '  Popis  ',
      caption: '  Popisek  ',
    }),
    { area: 'owner', id: cuid, isVisible: true, altText: 'Popis', caption: 'Popisek' },
  );
  assert.deepEqual(
    updateReferenceMediaSchema.parse({ area: 'owner', id: cuid, isVisible: ['false'], altText: '  ', caption: '' }),
    { area: 'owner', id: cuid, isVisible: false, altText: null, caption: null },
  );
  assert.equal(updateReferenceMediaSchema.safeParse({ area: 'owner', id: cuid, isVisible: ['true'], altText: 'a'.repeat(161), caption: null }).success, false);
  assert.equal(updateReferenceMediaSchema.safeParse({ area: 'owner', id: cuid, isVisible: ['true'], altText: null, caption: 'a'.repeat(301) }).success, false);
  assert.equal(updateReferenceMediaSchema.safeParse({ area: 'owner', id: cuid, isVisible: ['yes'], altText: null, caption: null }).success, false);
});

test('remove validuje id a oblast', () => {
  assert.equal(removeReferenceMediaSchema.safeParse({ area: 'salon', id: cuid }).success, true);
  assert.equal(removeReferenceMediaSchema.safeParse({ area: 'other', id: cuid }).success, false);
  assert.equal(removeReferenceMediaSchema.safeParse({ area: 'salon', id: '' }).success, false);
});
