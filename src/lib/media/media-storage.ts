import { MediaStorageProvider } from '@/generated/prisma/browser';

import { localMediaStorage, type MediaStorageAdapter } from '@/lib/media/local-media-storage';

export function getMediaStorageAdapter(provider: MediaStorageProvider): MediaStorageAdapter {
  switch (provider) {
    case MediaStorageProvider.LOCAL:
      return localMediaStorage;
  }
}
