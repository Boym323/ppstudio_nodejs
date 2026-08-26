import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('Reference actions validují payload před autorizací a domain helperem', async () => {
  const source = await readFile(new URL('./reference-media-actions.ts', import.meta.url), 'utf8');

  for (const action of ['addReferenceMediaAction', 'removeReferenceMediaAction', 'moveReferenceMediaAction', 'updateReferenceMediaAction']) {
    const start = source.indexOf(`export async function ${action}`);
    const end = source.indexOf('\nexport async function', start + 1);
    const block = source.slice(start, end === -1 ? undefined : end);
    assert.match(block, /\.safeParse\(/, action);
    assert.ok(block.indexOf('invalidReferenceMediaPayload()') < block.indexOf('authorize(parsed.data.area)'), action);
    assert.ok(block.indexOf('authorize(parsed.data.area)') < block.indexOf('await ', block.indexOf('authorize(parsed.data.area)') + 1), action);
  }
});
