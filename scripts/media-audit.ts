import 'dotenv/config';

import { createHash } from 'node:crypto';

import { prisma } from '@/lib/prisma';
import { localMediaStorage } from '@/lib/media/local-media-storage';

type ExpectedFile = { assetId: string; visibility: 'PUBLIC' | 'PRIVATE'; storagePath: string };

async function main() {
  const assets = await prisma.mediaAsset.findMany({
    select: {
      id: true, visibility: true, storagePath: true, optimizedStoragePath: true, thumbnailStoragePath: true,
    },
  });
  const expected = assets.flatMap<ExpectedFile>((asset) => [asset.storagePath, asset.optimizedStoragePath, asset.thumbnailStoragePath]
    .filter((storagePath): storagePath is string => Boolean(storagePath))
    .map((storagePath) => ({ assetId: asset.id, visibility: asset.visibility, storagePath })));
  const expectedKeys = new Set(expected.map((file) => `${file.visibility}:${file.storagePath}`));
  const missing = (await Promise.all(expected.map(async (file) => (
    await localMediaStorage.fileExists(file.visibility, file.storagePath) ? null : file
  )))).filter((file): file is ExpectedFile => file !== null);
  const files = await localMediaStorage.listFiles();
  const orphan = files.filter((file) => !expectedKeys.has(`${file.visibility}:${file.storagePath}`));
  const hashes = new Map<string, string[]>();
  await Promise.all(files.map(async (file) => {
    const hash = createHash('sha256').update(await localMediaStorage.readFile(file.visibility, file.storagePath)).digest('hex');
    const key = `${file.visibility}:${hash}`;
    hashes.set(key, [...(hashes.get(key) ?? []), file.storagePath]);
  }));
  const duplicateCandidates = [...hashes.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([key, paths]) => ({ visibility: key.split(':', 1)[0], sha256: key.slice(key.indexOf(':') + 1), storagePaths: paths.sort() }));

  console.log(JSON.stringify({ missing, orphan, duplicateCandidates }, null, 2));
}

void main().finally(() => prisma.$disconnect());
