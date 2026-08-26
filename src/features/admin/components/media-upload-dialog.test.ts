import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dialogPath = new URL('./media-upload-dialog.tsx', import.meta.url);
const pagePath = new URL('./admin-media-page.tsx', import.meta.url);
const dropzonePath = new URL('./media-upload-dropzone.tsx', import.meta.url);

test('Nahrát v Media Library otevírá existující Dialog s upload formulářem', async () => {
  const [dialog, page] = await Promise.all([readFile(dialogPath, 'utf8'), readFile(pagePath, 'utf8')]);

  assert.match(page, /<MediaUploadDialog area=\{area\} returnTo=\{returnTo\}/);
  assert.match(dialog, /import \* as Dialog from '@\/components\/ui\/dialog'/);
  assert.match(dialog, /<Dialog\.Trigger asChild>/);
  assert.match(dialog, /<Dialog\.Content className="max-w-2xl/);
  assert.match(dialog, /<form action=\{uploadMediaAction\}/);
});

test('upload formulář zachovává returnTo a zobrazuje pravidla ze serverové konfigurace', async () => {
  const [dialog, page] = await Promise.all([readFile(dialogPath, 'utf8'), readFile(pagePath, 'utf8')]);

  assert.match(dialog, /name="returnTo" value=\{returnTo\}/);
  assert.match(page, /mediaUploadPolicy\.allowedMimeTypes/);
  assert.match(page, /mediaUploadPolicy\.maxFileSizeBytes/);
  assert.match(dialog, /<MediaUploadDropzone name="file" accept=\{accept\} supportedTypes=\{supportedTypes\}/);
  assert.match(dialog, /Podporované typy: \{supportedTypes\}/);
  assert.match(dialog, /Maximální velikost souboru: \{maxFileSizeMb\} MB/);
});

test('dropzone zobrazuje vybraný soubor i lokální náhled obrázku', async () => {
  const source = await readFile(dropzonePath, 'utf8');

  assert.match(source, /selectedFile\?\.name/);
  assert.match(source, /URL\.createObjectURL\(selectedFile\)/);
  assert.match(source, /alt="Náhled vybraného obrázku"/);
});

test('upload má pending stav a UI nezobrazuje interní storage cestu', async () => {
  const [dialog, page] = await Promise.all([readFile(dialogPath, 'utf8'), readFile(pagePath, 'utf8')]);

  assert.match(dialog, /<PendingSubmitButton pendingLabel="Nahrávám a zpracovávám…"/);
  assert.match(dialog, /Nové médium bude po nahrání publikované/);
  assert.doesNotMatch(page, /images\/YYYY\/MM/);
});
