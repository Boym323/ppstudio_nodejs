import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const projectRoot = path.resolve(import.meta.dirname, "../..");

const requestTimePublicReads = [
  ["src/app/(public)/page.tsx", "await getHomepageFeaturedServices()"],
  ["src/app/(public)/sluzby/page.tsx", "await getPublicServices()"],
  ["src/app/(public)/sluzby/[slug]/page.tsx", "await getPublicServiceBySlug(slug)"],
  ["src/app/(public)/cenik/page.tsx", "await getPublicPricingCatalog()"],
  ["src/app/(public)/vouchery/page.tsx", "await getVoucherSuggestedServices()"],
  ["src/app/(public)/o-mne/page.tsx", "await Promise.all(["],
  ["src/app/(public)/studio/page.tsx", "await getPublicStudioPhotos()"],
  ["src/app/(public)/storno-podminky/page.tsx", "await getCancellationPageContent()"],
  ["src/app/(public)/gdpr/page.tsx", "await Promise.all(["],
  ["src/app/(public)/obchodni-podminky/page.tsx", "await Promise.all(["],
  ["src/features/public/components/public-home-page.tsx", "await Promise.all(["],
  ["src/features/public/components/voucher-landing-page.tsx", "await getPublicSalonProfile()"],
  ["src/features/public/components/contact-page.tsx", "await Promise.all(["],
  ["src/features/public/components/faq-page.tsx", "await getBookingPolicySettings()"],
  ["src/components/layout/site-shell.tsx", "await getPublicSalonProfile()"],
  ["src/components/layout/site-footer.tsx", "await getPublicSalonProfile()"],
] as const;

test("public database reads wait for an HTTP request", async () => {
  for (const [file, read] of requestTimePublicReads) {
    const source = await readFile(path.join(projectRoot, file), "utf8");
    const connectionIndex = source.indexOf("await connection();");
    const readIndex = source.indexOf(read);

    assert.match(source, /import \{ connection \} from ["']next\/server["'];/);
    assert.ok(connectionIndex >= 0, `${file} must wait for an incoming request`);
    assert.ok(readIndex >= 0, `${file} must perform the expected database-backed read`);
    assert.ok(connectionIndex < readIndex, `${file} must defer its read until after connection()`);
  }
});
