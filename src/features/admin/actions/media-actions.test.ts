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

test('membership veřejných kolekcí autorizovaně odmítá jen nové neveřejné assety a zachovává návrat', async () => {
  const [source, pageSource] = await Promise.all([
    actionSource(),
    readFile(new URL('../components/admin-media-page.tsx', import.meta.url), 'utf8'),
  ]);
  const membershipAction = actionBlock(source, 'updateMediaCollectionMembershipAction', 'updateMediaMetadataAction');

  assert.match(membershipAction, /action !== 'add' && action !== 'save' && action !== 'remove' && action !== 'move'/);
  assert.match(membershipAction, /requireAdminSectionAccess\(area, 'media'\)/);
  assert.match(membershipAction, /collectionType === MediaCollectionType\.STUDIO_GALLERY \|\| collectionType === MediaCollectionType\.CERTIFICATES \|\| collectionType === MediaCollectionType\.REFERENCES[\s\S]*\{ requirePublicAsset: true \}/);
  assert.match(membershipAction, /if \(!membership\) redirect\(flashUrl\(area, formData\.get\('returnTo'\), 'media-membership-asset-not-public'\)\)/);
  assert.match(membershipAction, /if \(action === 'remove'\) \{[\s\S]*mediaCollectionItem\.deleteMany/);
  assert.match(membershipAction, /redirect\(flashUrl\(area, formData\.get\('returnTo'\), 'media-membership-success'\)\)/);
  assert.match(pageSource, /'media-membership-asset-not-public': 'Před přidáním do kolekce médium publikujte\.'/);
});


test('hromadné akce médií autorizují, validují počet a zachovávají ochranu mazání', async () => {
  const source = await actionSource();
  const bulkAction = source.slice(source.indexOf('export async function bulkMediaAction'));

  assert.match(bulkAction, /bulkMediaSchema\.safeParse/);
  assert.match(source, /assetIds: z\.array\(z\.cuid\(\)\)\.min\(1\)\.max\(48\)/);
  assert.match(bulkAction, /requireAdminSectionAccess\(area, 'media'\)/);
  assert.match(bulkAction, /await deleteMedia\(id\)/);
  assert.match(bulkAction, /MEDIA_ASSET_IN_USE/);
  assert.match(bulkAction, /mediaAsset\.updateMany/);
  assert.match(bulkAction, /data: \{ isPublished: operation === 'publish' \}/);
});
