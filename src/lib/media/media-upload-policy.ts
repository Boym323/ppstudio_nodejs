export const mediaUploadPolicy = {
  maxFileSizeBytes: 8 * 1024 * 1024,
  allowedMimeTypes: new Map([
    ['image/jpeg', ['jpg', 'jpeg']],
    ['image/png', ['png']],
    ['image/webp', ['webp']],
    ['image/heic', ['heic']],
    ['image/heif', ['heif']],
  ]),
} as const;
