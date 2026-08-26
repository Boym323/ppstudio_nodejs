import assert from "node:assert/strict";
import test from "node:test";

import {
  backfillMediaLibraryV2,
  CERTIFICATE_ASSET_IDS,
  COLLECTION_TYPES,
  HIDDEN_STUDIO_ASSET_ID,
  SINGULAR_MEDIA,
  STUDIO_ASSET_IDS,
  VOUCHER_LOGO_ASSET_ID,
  assertAllowedBackfillDatabase,
  type MediaLibraryV2BackfillClient,
} from "../../../../scripts/media-library-v2-backfill";

type CollectionType = (typeof COLLECTION_TYPES)[number];
type MemoryCollection = { id: string; type: CollectionType };
type MemoryItem = {
  id: string;
  collectionId: string;
  mediaAssetId: string;
  sortOrder: number;
  isVisible: boolean;
};
type MemorySettings = {
  id: string;
  voucherPdfLogoMediaId: string | null;
  contactPhotoMediaId: string | null;
  homePortraitMediaId: string | null;
  aboutPortraitMediaId: string | null;
};

type MemoryState = {
  assets: Set<string>;
  collections: MemoryCollection[];
  items: MemoryItem[];
  settings: MemorySettings | null;
};

const ALL_TARGET_ASSETS = [
  ...CERTIFICATE_ASSET_IDS,
  ...STUDIO_ASSET_IDS,
  ...Object.values(SINGULAR_MEDIA),
  VOUCHER_LOGO_ASSET_ID,
];

const EXPECTED_CERTIFICATE_ORDER = [
  "cmod3lrnu0002h1o41urgylvb",
  "cmod6tg1y0000c9o4kx5tzsm7",
  "cmod6tpyx0001c9o48apynqz6",
  "cmod6u2050002c9o4ntksx58s",
  "cmod6ua2e0003c9o4dyf8pd0a",
  "cmsezuytz0001n9l15pwcjoca",
];

const EXPECTED_STUDIO_ORDER = [
  "cmoq71a3v0001arlc1c5i3woh",
  "cmp9x85w4000cm0l1cda89s3k",
  "cmoq75gfv0004arlcl2pfvitq",
  "cmoq73bfe0002arlcgop25wj8",
  "cmoq74d4u0003arlcvwppnkwm",
  "cmoq76gbq0005arlcwc6vdy1r",
];

function createState(overrides: Partial<MemoryState> = {}): MemoryState {
  return {
    assets: new Set(ALL_TARGET_ASSETS),
    collections: [],
    items: [],
    settings: {
      id: "site-settings",
      voucherPdfLogoMediaId: VOUCHER_LOGO_ASSET_ID,
      contactPhotoMediaId: null,
      homePortraitMediaId: null,
      aboutPortraitMediaId: null,
    },
    ...overrides,
  };
}

function memoryClient(state: MemoryState): MediaLibraryV2BackfillClient {
  let collectionCounter = state.collections.length;
  let itemCounter = state.items.length;

  return {
    mediaAsset: {
      async findMany(args) {
        const ids = (args as { where: { id: { in: string[] } } }).where.id.in;
        return ids.filter((id) => state.assets.has(id)).map((id) => ({ id }));
      },
    },
    mediaCollection: {
      async findMany() {
        return state.collections.map((collection) => ({ ...collection }));
      },
      async upsert(args) {
        const input = args as { where: { type: CollectionType }; create: { type: CollectionType } };
        const existing = state.collections.find(({ type }) => type === input.where.type);
        if (existing) return { ...existing };
        const created = { id: `collection-${++collectionCounter}`, type: input.create.type };
        state.collections.push(created);
        return { ...created };
      },
    },
    mediaCollectionItem: {
      async findMany(args) {
        const ids = (args as { where: { collectionId: { in: string[] } } }).where.collectionId.in;
        return state.items.filter(({ collectionId }) => ids.includes(collectionId)).map((item) => ({ ...item }));
      },
      async create(args) {
        const data = (args as { data: Omit<MemoryItem, "id"> }).data;
        assert.equal(
          state.items.some((item) => item.collectionId === data.collectionId && item.mediaAssetId === data.mediaAssetId),
          false,
          "duplicitní asset v kolekci",
        );
        assert.equal(
          state.items.some((item) => item.collectionId === data.collectionId && item.sortOrder === data.sortOrder),
          false,
          "duplicitní pořadí v kolekci",
        );
        const created = { id: `item-${++itemCounter}`, ...data };
        state.items.push(created);
        return { ...created };
      },
      async update(args) {
        const input = args as {
          where: { id: string };
          data: Partial<Pick<MemoryItem, "sortOrder" | "isVisible">>;
        };
        const item = state.items.find(({ id }) => id === input.where.id);
        assert.ok(item);
        const nextSortOrder = input.data.sortOrder ?? item.sortOrder;
        assert.equal(
          state.items.some((candidate) =>
            candidate.id !== item.id
            && candidate.collectionId === item.collectionId
            && candidate.sortOrder === nextSortOrder),
          false,
          "duplicitní pořadí při update",
        );
        Object.assign(item, input.data);
        return { ...item };
      },
    },
    siteSettings: {
      async findUnique() {
        return state.settings ? { ...state.settings } : null;
      },
      async update(args) {
        assert.ok(state.settings);
        const data = (args as { data: Partial<MemorySettings> }).data;
        Object.assign(state.settings, data);
        return { ...state.settings };
      },
    },
  };
}

function itemsFor(state: MemoryState, type: CollectionType) {
  const collection = state.collections.find((candidate) => candidate.type === type);
  assert.ok(collection);
  return state.items
    .filter(({ collectionId }) => collectionId === collection.id)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

test("backfill vytvoří přesné kolekce, pořadí a FK a druhý běh je beze změn", async () => {
  const state = createState();
  const client = memoryClient(state);

  const first = await backfillMediaLibraryV2(client);

  assert.deepEqual(first.createdCollections, COLLECTION_TYPES);
  assert.equal(first.createdMemberships, CERTIFICATE_ASSET_IDS.length + STUDIO_ASSET_IDS.length);
  assert.deepEqual(state.collections.map(({ type }) => type).sort(), [...COLLECTION_TYPES].sort());
  assert.equal(new Set(state.collections.map(({ type }) => type)).size, 3);

  const certificates = itemsFor(state, "CERTIFICATES");
  assert.deepEqual(certificates.map(({ mediaAssetId }) => mediaAssetId), EXPECTED_CERTIFICATE_ORDER);
  assert.deepEqual(certificates.map(({ sortOrder }) => sortOrder), [0, 1, 2, 3, 4, 5]);
  assert.equal(certificates.some(({ mediaAssetId }) => mediaAssetId === VOUCHER_LOGO_ASSET_ID), false);

  const studio = itemsFor(state, "STUDIO_GALLERY");
  assert.deepEqual(studio.map(({ mediaAssetId }) => mediaAssetId), EXPECTED_STUDIO_ORDER);
  assert.deepEqual(studio.map(({ sortOrder }) => sortOrder), [0, 1, 2, 3, 4, 5]);
  assert.equal(studio.find(({ mediaAssetId }) => mediaAssetId === HIDDEN_STUDIO_ASSET_ID)?.isVisible, false);
  assert.equal(studio.filter(({ mediaAssetId }) => mediaAssetId !== HIDDEN_STUDIO_ASSET_ID).every(({ isVisible }) => isVisible), true);
  assert.deepEqual(itemsFor(state, "REFERENCES"), []);
  assert.deepEqual(state.settings, {
    id: "site-settings",
    voucherPdfLogoMediaId: VOUCHER_LOGO_ASSET_ID,
    ...SINGULAR_MEDIA,
  });

  const snapshot = structuredClone({
    collections: state.collections,
    items: state.items,
    settings: state.settings,
  });
  const second = await backfillMediaLibraryV2(client);
  assert.deepEqual(second.createdCollections, []);
  assert.equal(second.createdMemberships, 0);
  assert.equal(second.updatedMemberships, 0);
  assert.deepEqual(second.updatedSiteSettingsFields, []);
  assert.deepEqual({ collections: state.collections, items: state.items, settings: state.settings }, snapshot);
});

test("chybějící produkční ID přeskočí bez dangling vazby a transparentně je reportuje", async () => {
  const missingCertificate = CERTIFICATE_ASSET_IDS[2];
  const missingStudio = STUDIO_ASSET_IDS[3];
  const missingSingular = SINGULAR_MEDIA.homePortraitMediaId;
  const assets = new Set(ALL_TARGET_ASSETS);
  assets.delete(missingCertificate);
  assets.delete(missingStudio);
  assets.delete(missingSingular);
  const state = createState({ assets });

  const report = await backfillMediaLibraryV2(memoryClient(state));

  assert.deepEqual(report.missingCollectionAssetIds, {
    CERTIFICATES: [missingCertificate],
    STUDIO_GALLERY: [missingStudio],
  });
  assert.deepEqual(report.missingSingularAssetIds, [missingSingular]);
  assert.equal(state.items.some(({ mediaAssetId }) => !assets.has(mediaAssetId)), false);
  assert.equal(state.settings?.homePortraitMediaId, null);
  assert.deepEqual(itemsFor(state, "CERTIFICATES").map(({ sortOrder }) => sortOrder), [0, 1, 2, 3, 4]);
  assert.deepEqual(itemsFor(state, "STUDIO_GALLERY").map(({ sortOrder }) => sortOrder), [0, 1, 2, 3, 4]);
});

test("produkční guard vyžaduje databázi ppstudio a DEV/test guard zůstává kompatibilní", () => {
  const env = process.env as Record<string, string | undefined>;
  const previousNodeEnv = env.NODE_ENV;

  env.NODE_ENV = "production";
  assert.doesNotThrow(() => assertAllowedBackfillDatabase("postgresql://localhost/ppstudio", "ppstudio"));
  assert.throws(() => assertAllowedBackfillDatabase("postgresql://localhost/ppstudio_dev", "ppstudio_dev"));
  assert.throws(() => assertAllowedBackfillDatabase("postgresql://localhost/ppstudio", "ppstudio_dev"));

  env.NODE_ENV = "test";
  assert.doesNotThrow(() => assertAllowedBackfillDatabase("postgresql://localhost/ppstudio_dev", "ppstudio_dev"));
  assert.doesNotThrow(() => assertAllowedBackfillDatabase("postgresql://localhost/example_test", "example_test"));

  if (previousNodeEnv === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = previousNodeEnv;
});

test("částečný backfill dorovná bez duplicit a zachová existující membership ID", async () => {
  const certificates: MemoryCollection = { id: "certificates", type: "CERTIFICATES" };
  const gallery: MemoryCollection = { id: "gallery", type: "STUDIO_GALLERY" };
  const state = createState({
    collections: [certificates, gallery],
    items: [
      {
        id: "existing-certificate",
        collectionId: certificates.id,
        mediaAssetId: CERTIFICATE_ASSET_IDS[0],
        sortOrder: 8,
        isVisible: false,
      },
      {
        id: "existing-studio",
        collectionId: gallery.id,
        mediaAssetId: STUDIO_ASSET_IDS[0],
        sortOrder: 0,
        isVisible: true,
      },
    ],
  });

  const report = await backfillMediaLibraryV2(memoryClient(state));

  assert.deepEqual(report.createdCollections, ["REFERENCES"]);
  assert.equal(state.collections.length, 3);
  assert.equal(state.items.length, CERTIFICATE_ASSET_IDS.length + STUDIO_ASSET_IDS.length);
  assert.equal(new Set(state.items.map(({ id }) => id)).size, state.items.length);
  assert.equal(state.items.find(({ id }) => id === "existing-certificate")?.sortOrder, 0);
  assert.equal(state.items.find(({ id }) => id === "existing-certificate")?.isVisible, true);
  assert.equal(state.items.find(({ id }) => id === "existing-studio")?.isVisible, false);
});

test("neočekávaný membership ani obsazenou singularní roli tiše nepřepíše", async () => {
  const certificates: MemoryCollection = { id: "certificates", type: "CERTIFICATES" };
  const state = createState({
    collections: [certificates],
    items: [{
      id: "unexpected",
      collectionId: certificates.id,
      mediaAssetId: VOUCHER_LOGO_ASSET_ID,
      sortOrder: 0,
      isVisible: true,
    }],
    settings: {
      id: "site-settings",
      voucherPdfLogoMediaId: VOUCHER_LOGO_ASSET_ID,
      contactPhotoMediaId: VOUCHER_LOGO_ASSET_ID,
      homePortraitMediaId: null,
      aboutPortraitMediaId: null,
    },
  });

  await assert.rejects(
    backfillMediaLibraryV2(memoryClient(state)),
    /CERTIFICATES obsahuje neočekávaný asset[\s\S]*contactPhotoMediaId už odkazuje na jiný asset/,
  );
});
