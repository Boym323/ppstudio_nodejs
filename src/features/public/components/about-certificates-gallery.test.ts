import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const galleryPath = new URL('./about-certificates-gallery.tsx', import.meta.url);

test('veřejné certifikáty otevírají vybraný obrázek v přístupném Radix Dialogu', async () => {
  const source = await readFile(galleryPath, 'utf8');

  assert.match(source, /import \* as Dialog from '@\/components\/ui\/dialog';/);
  assert.match(source, /<Dialog\.Root[\s\S]*open=\{Boolean\(selectedCertificate\)\}/);
  assert.match(source, /<Dialog\.Trigger asChild>/);
  assert.match(source, /onClick=\{\(\) => setSelectedId\(certificate\.id\)\}/);
  assert.match(source, /<Dialog\.Portal>/);
  assert.match(source, /<Dialog\.Overlay className="z-\[120\] bg-black\/78 backdrop-blur-none" \/>/);
  assert.match(source, /<Dialog\.Content/);
  assert.match(source, /<Dialog\.Title className="sr-only">\{selectedCertificate\.title\}<\/Dialog\.Title>/);
  assert.match(source, /<Dialog\.Description className="sr-only">\{selectedCertificate\.hint\}<\/Dialog\.Description>/);
  assert.match(source, /<Dialog\.Close asChild>[\s\S]*Zavřít náhled certifikátu/);
  assert.match(source, /src=\{selectedCertificate\.imageUrl\}/);
  assert.match(source, /alt=\{selectedCertificate\.alt\}/);
  assert.match(source, /className="object-contain"/);
});

test('veřejný lightbox certifikátů už neobsahuje vlastní modalní chování', async () => {
  const source = await readFile(galleryPath, 'utf8');

  assert.doesNotMatch(source, /useEffect/);
  assert.doesNotMatch(source, /addEventListener\('keydown'/);
  assert.doesNotMatch(source, /role="dialog"/);
  assert.doesNotMatch(source, /aria-modal/);
  assert.doesNotMatch(source, /stopPropagation/);
});
