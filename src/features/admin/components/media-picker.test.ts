import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('MediaPicker vrací existující MediaAsset.id bez kopírování assetu', async () => {
  process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public';
  process.env.ADMIN_SESSION_SECRET = 'test-secret-value-with-at-least-32-chars';
  process.env.ADMIN_OWNER_EMAIL = 'owner@example.com';
  const { selectedMediaAssetId } = await import('./media-picker');
  assert.equal(selectedMediaAssetId('cmasset123'), 'cmasset123');
});

test('MediaPicker načítá až po otevření, debouncuje search a chrání pořadí odpovědí', async () => {
  const source = await readFile(new URL('./media-picker.tsx', import.meta.url), 'utf8');
  assert.match(source, /if \(!enabled\) return/);
  assert.match(source, /window\.setTimeout[\s\S]*300/);
  assert.match(source, /setPage\(1\)/);
  assert.match(source, /currentRequest !== requestId\.current/);
});

test('MediaPicker drží selected summary a vykresluje pagination i všechny síťové stavy', async () => {
  const source = await readFile(new URL('./media-picker.tsx', import.meta.url), 'utf8');
  assert.match(source, /selectedAsset\?\.id === value/);
  assert.match(source, /Načítám média/);
  assert.match(source, /Zkusit znovu/);
  assert.match(source, /Tomuto hledání neodpovídá žádné médium/);
  assert.match(source, /Strana \{result\.page\} z \{result\.pageCount\}/);
  assert.match(source, /disabled=\{isPending \|\| result\.page >= result\.pageCount\}/);
});
