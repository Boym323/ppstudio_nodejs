import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const detailDialogPath = new URL('./media-asset-detail-dialog.tsx', import.meta.url);

test('detail assetu Media Library používá Dialog mimo kartu a potvrzuje fyzické smazání', async () => {
  const source = await readFile(detailDialogPath, 'utf8');

  assert.match(source, /<Dialog\.Root>/);
  assert.match(source, /<Dialog\.Content className="max-w-5xl/);
  assert.doesNotMatch(source, /<details/);
  assert.match(source, /<AlertDialog\.Root>/);
  assert.match(source, /MediaAsset .* fyzické varianty/);
  assert.match(source, /Tuto operaci nelze vrátit/);
  assert.match(source, /Smazání je blokované: asset se používá ve vazbách uvedených výše/);
  assert.match(source, /Náhrada zachová ID assetu i všechny existující vazby/);
  assert.match(source, /type: 'REFERENCES', label: 'Reference'/);
  assert.match(source, /isAdminPreview/);
  assert.match(source, /<img src=\{asset\.adminPreviewUrl!\}/);
});
