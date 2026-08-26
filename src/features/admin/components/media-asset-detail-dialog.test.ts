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

test('Studio a Certifikáty mění pořadí tlačítky, Reference workflow zůstává oddělené', async () => {
  const source = await readFile(detailDialogPath, 'utf8');

  assert.match(source, /collection\.type === 'STUDIO_GALLERY' \|\| collection\.type === 'CERTIFICATES'/);
  assert.match(source, /↑ Nahoru/);
  assert.match(source, /↓ Dolů/);
  assert.match(source, /disabled=\{!membership\.canMoveUp\}/);
  assert.match(source, /disabled=\{!membership\.canMoveDown\}/);
  assert.doesNotMatch(source, /name="sortOrder"/);
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

test('náhrada nepoužitého média odešle formulář přímo, používané vyžaduje potvrzení se skutečným souborem', async () => {
  const source = await readFile(detailDialogPath, 'utf8');
  const replaceAction = source.slice(source.indexOf('function ReplaceMediaAction'), source.indexOf('function PublishAction'));

  assert.match(replaceAction, /if \(!usage\.isUsed \|\| allowSubmitRef\.current\) return/);
  assert.match(replaceAction, /event\.preventDefault\(\)/);
  assert.match(replaceAction, /Nahradit používané médium\?/);
  assert.match(replaceAction, /Nový obrázek nahradí současný na všech místech použití/);
  assert.match(replaceAction, /usage\.references\.length/);
  assert.match(replaceAction, /visibleReferences = usage\.references\.slice\(0, 3\)/);
  assert.match(replaceAction, /a další \{remainingReferences\} použití/);
  assert.match(replaceAction, /<AlertDialog\.Cancel asChild><button type="button"[^>]*>Zrušit/);
  assert.match(replaceAction, /'Nahradit všude'/);
  assert.match(replaceAction, /setIsReplacing\(true\)/);
  assert.match(replaceAction, /formRef\.current\?\.requestSubmit\(\)/);
  assert.match(replaceAction, /action=\{replaceMediaAction\}/);
  assert.match(replaceAction, /name="file"/);
  assert.match(replaceAction, /name="assetId" value=\{assetId\}/);
  assert.match(replaceAction, /name="area" value=\{area\}/);
  assert.match(replaceAction, /name="returnTo" value=\{returnTo\}/);
});
