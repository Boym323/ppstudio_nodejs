import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('MediaCollectionSection spravuje Studio i Certifikáty ve stejném řazení a bez zásahu do Reference workflow', async () => {
  const [source, referenceSource, actionsSource] = await Promise.all([
    readFile(new URL('./media-collection-section.tsx', import.meta.url), 'utf8'),
    readFile(new URL('./reference-media-section.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../actions/media-actions.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(source, /STUDIO_GALLERY: \{ label: 'Studio', objectFit: 'object-cover' \}/);
  assert.match(source, /CERTIFICATES: \{ label: 'Certifikáty', objectFit: 'object-contain' \}/);
  assert.match(source, /items\.map\(\(item, index\)/);
  assert.match(source, /#\{index \+ 1\}/);
  assert.match(source, /disabled=\{index === 0\}/);
  assert.match(source, /disabled=\{index === items\.length - 1\}/);
  assert.match(source, /name="isVisible" value=\{item\.isVisible \? 'false' : 'true'\}/);
  assert.match(source, /name="action" value="remove"/);
  assert.match(source, /Přidat z knihovny/);
  assert.match(source, /enabled=\{pickerOpen\} scope=\{\{ type: 'COLLECTION', collectionType \}\}/);
  assert.doesNotMatch(source, /assets=\{assets\}/);
  assert.match(source, /Přidá se na konec kolekce/);
  assert.match(source, /object-contain/);
  assert.match(actionsSource, /moveMediaCollectionItem\(tx, collection\.id, membership\.id, direction\)/);
  assert.match(actionsSource, /saveMediaCollectionMembership\([\s\S]*tx,[\s\S]*collection\.id,[\s\S]*assetId,[\s\S]*isVisible/);
  assert.match(referenceSource, /addReferenceMediaAction, moveReferenceMediaAction, removeReferenceMediaAction, updateReferenceMediaAction/);
  assert.match(referenceSource, /Alt text pro referenci/);
  assert.doesNotMatch(referenceSource, /MediaCollectionSection/);
});
