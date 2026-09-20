import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const actionsDirectory = path.dirname(fileURLToPath(import.meta.url));
const featuresDirectory = path.resolve(actionsDirectory, "../..");

async function readFeatureFile(relativePath: string) {
  return readFile(path.join(featuresDirectory, relativePath), "utf8");
}

test("payment action boundary exports only actions and derives audit actor from the authorized session", async () => {
  const source = await readFeatureFile("booking/payments/actions/booking-payment-actions.ts");

  assert.deepEqual(
    [...source.matchAll(/^export async function (\w+)/gm)].map((match) => match[1]),
    ["createBookingPaymentAction", "updateBookingPaymentAction", "deleteBookingPaymentAction"],
  );
  assert.match(source, /requireRole\(\[AdminRole\.OWNER\]\)/);
  assert.match(source, /voidedByUserId:\s*session\.sub/);
  assert.doesNotMatch(source, /voidedByUserId:\s*readFormString/);
  assert.doesNotMatch(source, /export async function voidBookingPaymentWithAudit/);
});

test("voucher email action boundary keeps queueing behind the authorized action", async () => {
  const source = await readFeatureFile("admin/actions/voucher-email-actions.ts");

  assert.deepEqual(
    [...source.matchAll(/^export async function (\w+)/gm)].map((match) => match[1]),
    ["sendVoucherEmailAction"],
  );
  assert.match(source, /requireRole\(\[AdminRole\.OWNER, AdminRole\.SALON\]\)/);
  assert.match(source, /await queueVoucherEmailLog\(/);
  assert.doesNotMatch(source, /export async function queueVoucherEmailLog/);
});

test("Voucher Stock mutace vracejí bezpečný action state pro domain i runtime chyby", async () => {
  const source = await readFeatureFile("admin/actions/voucher-stock-actions.ts");

  for (const action of ["receiveVoucherPrintBatchAction", "closeVoucherPrintBatchAction", "voidVoucherStockItemAction"]) {
    assert.match(source, new RegExp(`export async function ${action}\\([\\s\\S]*?try \\{`));
  }

  for (const code of [
    "batchNotFound",
    "batchClosed",
    "itemNotReceived",
    "integrityError",
    "transientConflict",
    "operationFailed",
  ]) {
    assert.match(source, new RegExp(`\\[voucherStockOperationErrorCodes\\.${code}\\]:`));
  }

  assert.match(source, /return null;/);
  assert.doesNotMatch(source, /default:\s*return error\.message/);
  assert.doesNotMatch(source, /switch \(error\.code\)/);
  assert.match(source, /Voucher Stock admin action failed/);
  assert.match(source, /Položku lze znehodnotit až po převzetí série\./);
  assert.match(source, /Voucher má nekonzistentní data\. Obnovte stránku nebo kontaktujte správce\./);
});

test("Voucher Stock action boundary runtime převádí domain i neočekávané chyby a revaliduje po úspěchu", async (t) => {
  let session = { sub: "admin-test", role: "OWNER" };
  let receiveImplementation: (input: unknown) => Promise<unknown> = async () => undefined;
  let closeImplementation: (input: unknown) => Promise<unknown> = async () => undefined;
  let voidImplementation: (input: unknown) => Promise<unknown> = async () => undefined;
  const revalidatedPaths: string[] = [];

  class MockVoucherStockOperationError extends Error {
    constructor(readonly code: string, message: string) {
      super(message);
      this.name = "VoucherStockOperationError";
    }
  }

  const codes = {
    batchNotFound: "BATCH_NOT_FOUND",
    itemNotFound: "STOCK_ITEM_NOT_FOUND",
    invalidQuantity: "INVALID_QUANTITY",
    invalidTemplate: "INVALID_TEMPLATE",
    templateUnavailable: "TEMPLATE_UNAVAILABLE",
    templateNotAllowed: "TEMPLATE_NOT_ALLOWED",
    batchAlreadyReceived: "BATCH_ALREADY_RECEIVED",
    batchClosed: "BATCH_CLOSED",
    itemNotAvailable: "ITEM_NOT_AVAILABLE",
    itemAlreadyActivated: "ITEM_ALREADY_ACTIVATED",
    itemVoided: "ITEM_VOIDED",
    serviceNotActive: "SERVICE_NOT_ACTIVE",
    servicePriceMissing: "SERVICE_PRICE_MISSING",
    invalidValidityRange: "INVALID_VALIDITY_RANGE",
    integrityError: "INTEGRITY_ERROR",
    transientConflict: "TRANSIENT_CONFLICT",
    operationFailed: "OPERATION_FAILED",
    voidReasonRequired: "VOID_REASON_REQUIRED",
    itemNotReceived: "ITEM_NOT_RECEIVED",
  } as const;

  t.mock.module("@/features/vouchers/lib/voucher-stock", {
    exports: {
      activateVoucherStockItem: async () => undefined,
      createVoucherPrintBatch: async () => undefined,
      findVoucherStockItemByCode: async () => null,
      receiveVoucherPrintBatch: (input: unknown) => receiveImplementation(input),
      closeVoucherPrintBatch: (input: unknown) => closeImplementation(input),
      voidVoucherStockItem: (input: unknown) => voidImplementation(input),
      VoucherStockOperationError: MockVoucherStockOperationError,
      voucherStockOperationErrorCodes: codes,
    },
  });
  t.mock.module("@/lib/auth/session", { exports: { requireRole: async () => session } });
  t.mock.module("next/cache", { exports: { revalidatePath: (path: string) => revalidatedPaths.push(path) } });
  t.mock.module("next/navigation", { exports: { redirect: () => undefined } });
  t.mock.module("@/features/admin/lib/admin-voucher-stock", {
    exports: {
      getAdminVoucherStockHref: (area: string) => `/${area}/stock`,
      getAdminVoucherStockBatchHref: (area: string, batchId: string) => `/${area}/stock/${batchId}`,
      getAdminVoucherActivationHref: (area: string) => `/${area}/activation`,
    },
  });

  const actions = await import("./voucher-stock-actions");
  const initialState = { status: "idle" as const };
  const form = (values: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(values)) data.set(key, value);
    return data;
  };

  voidImplementation = async () => {
    throw new MockVoucherStockOperationError(codes.itemNotReceived, "INTERNAL SECRET MESSAGE");
  };
  let state = await actions.voidVoucherStockItemAction(initialState, form({ stockItemId: "item-1", batchId: "batch-1", area: "owner" }));
  assert.deepEqual(state, { status: "error", formError: "Položku lze znehodnotit až po převzetí série." });
  assert.doesNotMatch(JSON.stringify(state), /INTERNAL SECRET MESSAGE/);

  voidImplementation = async () => {
    throw new MockVoucherStockOperationError(codes.integrityError, "secret integrity detail");
  };
  state = await actions.voidVoucherStockItemAction(initialState, form({ stockItemId: "item-1", batchId: "batch-1", area: "owner" }));
  assert.equal(state.status, "error");
  assert.equal(state.formError, "Voucher má nekonzistentní data. Obnovte stránku nebo kontaktujte správce.");
  assert.doesNotMatch(JSON.stringify(state), /secret integrity detail/);

  const unexpectedError = new Error("secret database detail");
  const loggedErrors: unknown[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => loggedErrors.push(args));
  voidImplementation = async () => {
    throw unexpectedError;
  };
  state = await actions.voidVoucherStockItemAction(initialState, form({ stockItemId: "item-1", batchId: "batch-1", area: "owner" }));
  assert.deepEqual(state, { status: "error", formError: "Položku se teď nepodařilo znehodnotit. Zkuste to prosím znovu." });
  assert.doesNotMatch(JSON.stringify(state), /secret database detail/);
  assert.equal(loggedErrors.length, 1);
  assert.equal((loggedErrors[0] as [string, { error?: unknown }])[1].error, unexpectedError);

  session = { sub: "admin-test", role: "OWNER" };
  receiveImplementation = async () => {
    throw new MockVoucherStockOperationError(codes.batchClosed, "internal closed detail");
  };
  state = await actions.receiveVoucherPrintBatchAction(initialState, form({ batchId: "batch-1" }));
  assert.deepEqual(state, { status: "error", formError: "Uzavřená tisková série už nejde měnit." });

  closeImplementation = async () => {
    throw new MockVoucherStockOperationError(codes.batchNotFound, "internal missing detail");
  };
  state = await actions.closeVoucherPrintBatchAction(initialState, form({ batchId: "batch-1" }));
  assert.deepEqual(state, { status: "error", formError: "Tisková série nebyla nalezena." });

  revalidatedPaths.length = 0;
  receiveImplementation = async () => ({ changed: true });
  state = await actions.receiveVoucherPrintBatchAction(initialState, form({ batchId: "batch-1" }));
  assert.deepEqual(state, { status: "success" });
  assert.deepEqual(revalidatedPaths, ["/owner/stock", "/owner/stock/batch-1"]);

  revalidatedPaths.length = 0;
  closeImplementation = async () => ({ changed: true });
  state = await actions.closeVoucherPrintBatchAction(initialState, form({ batchId: "batch-1" }));
  assert.deepEqual(state, { status: "success" });
  assert.deepEqual(revalidatedPaths, ["/owner/stock", "/owner/stock/batch-1"]);

  revalidatedPaths.length = 0;
  session = { sub: "admin-test", role: "SALON" };
  voidImplementation = async () => undefined;
  state = await actions.voidVoucherStockItemAction(initialState, form({ stockItemId: "item-1", batchId: "batch-1", area: "salon" }));
  assert.deepEqual(state, { status: "success" });
  assert.deepEqual(revalidatedPaths, ["/salon/stock", "/salon/stock/batch-1"]);
});

test("internal DB mutation helpers are server-only modules", async () => {
  const [paymentMutationSource, voucherQueueSource] = await Promise.all([
    readFeatureFile("booking/payments/lib/booking-payment-mutations.ts"),
    readFeatureFile("admin/lib/voucher-email-queue.ts"),
  ]);

  assert.match(paymentMutationSource, /^import "server-only";/);
  assert.match(voucherQueueSource, /^import "server-only";/);
});

test("galerie a denní oběd nevystavují interní zápisy jako veřejné server actions", async () => {
  const [gallerySource, settingsSource, galleryMutationSource, lunchMutationSource] = await Promise.all([
    readFeatureFile("admin/actions/service-media-actions.ts"),
    readFeatureFile("admin/actions/settings-actions.ts"),
    readFeatureFile("admin/lib/service-media-mutations.ts"),
    readFeatureFile("admin/lib/admin-auto-lunch.ts"),
  ]);

  assert.doesNotMatch(gallerySource, /export async function createServiceGalleryMediaWithRetry/);
  assert.doesNotMatch(settingsSource, /export async function persistAutoLunchDayMode/);
  assert.match(galleryMutationSource, /^import "server-only";/);
  assert.match(lunchMutationSource, /^import "server-only";/);
});
