import { z } from 'zod';

const referenceIdSchema = z.cuid('Neplatný identifikátor reference.');
const referenceAreaSchema = z.enum(['owner', 'salon']);

function optionalReferenceText(max: number, message: string) {
  return z.preprocess(
    (value) => (typeof value === 'string' ? value.trim() || null : value ?? null),
    z.string().max(max, message).nullable(),
  );
}

const referenceVisibilitySchema = z
  .array(z.enum(['true', 'false']))
  .min(1)
  .max(2)
  .refine(
    (values) => values.length === 1 || (values[0] === 'false' && values[1] === 'true'),
    'Neplatná hodnota viditelnosti.',
  )
  .transform((values) => values.at(-1) === 'true');

export const addReferenceMediaSchema = z.object({
  area: referenceAreaSchema,
  mediaAssetId: referenceIdSchema,
});

export const removeReferenceMediaSchema = z.object({
  area: referenceAreaSchema,
  id: referenceIdSchema,
});

export const moveReferenceMediaSchema = z.object({
  area: referenceAreaSchema,
  id: referenceIdSchema,
  direction: z.enum(['up', 'down']),
});

export const updateReferenceMediaSchema = z.object({
  area: referenceAreaSchema,
  id: referenceIdSchema,
  isVisible: referenceVisibilitySchema,
  altText: optionalReferenceText(160, 'Alt text může mít maximálně 160 znaků.'),
  caption: optionalReferenceText(300, 'Popisek může mít maximálně 300 znaků.'),
});

export function invalidReferenceMediaPayload(): never {
  throw new Error('Neplatný payload referencí.');
}
