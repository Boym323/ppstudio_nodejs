import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const detailDialogPath = new URL('./media-asset-detail-dialog.tsx', import.meta.url);

test('detail média Media Library používá Dialog mimo kartu a potvrzuje odstranění', async () => {
  const source = await readFile(detailDialogPath, 'utf8');

  assert.match(source, /<Dialog\.Root>/);
  assert.match(source, /<Dialog\.Content className="max-w-5xl/);
  assert.doesNotMatch(source, /<details/);
  assert.match(source, /<AlertDialog\.Root>/);
  assert.match(source, /Odstraní se médium .* Tuto operaci nelze vrátit/);
  assert.match(source, /Tuto operaci nelze vrátit/);
  assert.match(source, /Smazání je blokované: médium se používá na místech uvedených výše/);
  assert.match(source, /Náhrada zachová všechna použití tohoto média/);
  assert.match(source, />Detail média</);
  assert.doesNotMatch(source, /MediaAsset „/);
  assert.doesNotMatch(source, /fyzické varianty/);
  assert.match(source, /type: 'REFERENCES', label: 'Reference'/);
  assert.match(source, /isAdminPreview/);
  assert.match(source, /<img src=\{asset\.adminPreviewUrl!\}/);
});

test('nepoužité médium a publikování nevyžadují potvrzení, zrušení publikace používaného média ano', async () => {
  const source = await readFile(detailDialogPath, 'utf8');

  assert.match(source, /return isPublished && isUsed/);
  assert.match(source, /if \(!requiresUnpublishConfirmation\(asset\.isPublished, usage\.isUsed\)\) return <form action=\{updateMediaPublicationAction\}/);
  assert.match(source, /asset\.isPublished \? 'Zrušit publikaci' : 'Publikovat'/);
  assert.match(source, /return <AlertDialog\.Root>/);
});

test('potvrzení zrušení publikace zachová action i returnTo a zrušení nic neodesílá', async () => {
  const source = await readFile(detailDialogPath, 'utf8');
  const publishAction = source.slice(source.indexOf('function PublishAction'), source.indexOf('function Memberships'));

  assert.match(publishAction, /Po zrušení publikace může zmizet z veřejného webu/);
  assert.match(publishAction, /usage\.references\.length/);
  assert.match(publishAction, /visibleReferences = usage\.references\.slice\(0, 3\)/);
  assert.match(publishAction, /<form action=\{updateMediaPublicationAction\}/);
  assert.match(publishAction, /name="returnTo" value=\{returnTo\}/);
  assert.doesNotMatch(publishAction, /name="title"/);
  assert.doesNotMatch(publishAction, /name="altText"/);
  assert.match(publishAction, /<AlertDialog\.Cancel asChild><button type="button"[^>]*>Ponechat publikované/);
  assert.match(publishAction, /<PendingSubmitButton[^>]*>Zrušit publikaci<\/PendingSubmitButton>/);
});
