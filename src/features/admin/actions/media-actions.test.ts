import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const actionPath = new URL('./media-actions.ts', import.meta.url);

async function actionSource() {
  return readFile(actionPath, 'utf8');
}

function actionBlock(source: string, name: string, nextName: string) {
  return source.slice(source.indexOf(`export async function ${name}`), source.indexOf(`export async function ${nextName}`));
}

test('akce metadat zapisuje jen title a altText se stejnou autorizací a návratem', async () => {
  const source = await actionSource();
  const metadataAction = actionBlock(source, 'updateMediaMetadataAction', 'updateMediaPublicationAction');

  assert.match(metadataAction, /updateMediaMetadataSchema\.safeParse/);
  assert.match(metadataAction, /requireAdminSectionAccess\(parsed\.data\.area, 'media'\)/);
  assert.match(metadataAction, /title: normalizeOptionalText\(parsed\.data\.title\)/);
  assert.match(metadataAction, /altText: normalizeOptionalText\(parsed\.data\.altText\)/);
  assert.doesNotMatch(metadataAction, /isPublished/);
  assert.match(metadataAction, /flashUrl\(parsed\.data\.area, formData\.get\('returnTo'\), 'media-update-success'\)/);
});

test('akce publikace přijímá a zapisuje jen isPublished se stejnou autorizací a návratem', async () => {
  const source = await actionSource();
  const publicationAction = actionBlock(source, 'updateMediaPublicationAction', 'deleteMediaAction');

  assert.match(publicationAction, /updateMediaPublicationSchema\.safeParse/);
  assert.match(publicationAction, /isPublished: formData\.get\('isPublished'\)/);
  assert.match(publicationAction, /requireAdminSectionAccess\(parsed\.data\.area, 'media'\)/);
  assert.match(publicationAction, /isPublished: parsed\.data\.isPublished/);
  assert.doesNotMatch(publicationAction, /formData\.get\('title'\)|formData\.get\('altText'\)|title:|altText:/);
  assert.match(publicationAction, /flashUrl\(parsed\.data\.area, formData\.get\('returnTo'\), 'media-update-success'\)/);
});
