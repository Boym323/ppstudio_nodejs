import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";

import { defaultVoucherTemplateLayout } from "../../src/features/vouchers/lib/voucher-template-defaults";
import type { VoucherTemplateLayoutV1 } from "../../src/features/vouchers/lib/voucher-template-layout";
import { fitVoucherTextToArea, getVoucherTextBaselineRangeMm } from "../../src/features/vouchers/lib/voucher-text-fit";

// Isolated browser regression: real React/Rnd editor, no application server or DB.
test("editor opraví geometrii, zobrazí overflow a neopakuje identický chybný náhled", async () => {
  const bundle = await build({
    stdin: {
      contents: `import { createRoot } from "react-dom/client";
        import { VoucherTemplateLayoutEditor } from "./src/features/admin/components/voucher-template-layout-editor";
        import { defaultVoucherTemplateLayout } from "./src/features/vouchers/lib/voucher-template-defaults";
        createRoot(document.getElementById("root")).render(<VoucherTemplateLayoutEditor templateId="test" initialLayout={defaultVoucherTemplateLayout} initialUpdatedAt="2026-10-06T10:00:00Z" />);`,
      resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [{
      name: "editor-boundaries",
      setup(builder) {
        builder.onResolve({ filter: /^@\/features\/admin\/actions\/voucher-template-actions$/ }, () => ({ path: "actions", namespace: "editor-test" }));
        builder.onResolve({ filter: /^next\/image$/ }, () => ({ path: "image", namespace: "editor-test" }));
        builder.onResolve({ filter: /voucher-font-registry$/ }, () => ({ path: "fonts", namespace: "editor-test" }));
        builder.onLoad({ filter: /.*/, namespace: "editor-test" }, ({ path }) => ({
          contents: path === "fonts"
            ? 'export const voucherFontRegistry = { "noto-sans": {} };'
            : path === "actions"
            ? 'export async function saveVoucherTemplateLayoutAction() { return { updatedAt: "2026-10-06T11:00:00Z" }; }'
            : 'import React from "react"; export default function Image({ fill, unoptimized, ...props }) { return React.createElement("img", props); }',
          resolveDir: process.cwd(), loader: "js",
        }));
      },
    }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
    const requests: { layout: VoucherTemplateLayoutV1; previewType: string; overflowed: boolean }[] = [];
    const browserErrors: string[] = [];
    page.on("pageerror", (error) => browserErrors.push(error.message));
    await page.route("http://editor.test/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html; charset=utf-8", body: `<meta charset="utf-8"><style>
          body { margin: 0; } .relative { position: relative; } .absolute { position: absolute; }
          .inset-0 { inset: 0; } .pointer-events-none { pointer-events: none; }
          .z-10 { z-index: 10; } .z-20 { z-index: 20; }
          .overflow-auto { width: 900px; height: 480px; } .m-auto { margin: auto; }
          input { width: 100px; } aside { position: relative; }
          </style><div id="root"></div><script>${bundle.outputFiles[0].text}</script>` });
        return;
      }
      const { layout } = route.request().postDataJSON() as { layout: VoucherTemplateLayoutV1 };
      const previewType = url.searchParams.get("previewType") ?? "VALUE";
      const area = previewType === "SERVICE" ? layout.serviceArea : layout.valueArea;
      const fit = fitVoucherTextToArea(previewType === "SERVICE" ? "Testovací služba" : "1 500 Kč", area, (text, size) => text.length * size * 0.12);
      requests.push({ layout, previewType, overflowed: fit.overflowed });
      if (fit.overflowed) {
        await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ code: "text_overflow", message: `Dynamický text se nevejde do oblasti „${previewType === "SERVICE" ? "Služba" : "Hodnota"}“ ani při minimální velikosti písma.` }) });
      } else {
        await route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aP5sAAAAASUVORK5CYII=", "base64") });
      }
    });
    await page.goto("http://editor.test/");
    await expect.poll(() => requests.length).toBe(1);
    assert.deepEqual(requests[0].layout, defaultVoucherTemplateLayout);
    assert.equal(requests[0].overflowed, false);
    await page.getByText("Pokročilé nastavení", { exact: false }).click();
    const commit = async (label: string, value: string) => {
      await page.getByLabel(label, { exact: true }).fill(value);
      await page.getByLabel(label, { exact: true }).press("Enter");
    };
    const settled = async () => {
      await expect(page.getByText("Aktualizuji náhled; zobrazen je předchozí výsledek…", { exact: true })).toHaveCount(0);
    };
    await settled();
    await commit("Baseline (mm)", "39");
    await settled();
    let current = requests.at(-1)!.layout;
    assert.equal(current.valueArea.baselineMm, getVoucherTextBaselineRangeMm(current.valueArea, 16.5).minBaselineMm);
    await commit("Výška [mm]", "8");
    await settled();
    current = requests.at(-1)!.layout;
    assert.equal(current.valueArea.heightMm, 8);
    assert.equal(current.valueArea.baselineMm, getVoucherTextBaselineRangeMm(current.valueArea, 16.5).minBaselineMm);
    await commit("Min. velikost (pt)", "10");
    await settled();
    await commit("Velikost (pt)", "20");
    await settled();
    await commit("Baseline (mm)", String(requests.at(-1)!.layout.valueArea.yMm));
    await settled();
    await commit("Min. velikost (pt)", "12");
    await settled();
    current = requests.at(-1)!.layout;
    assert.equal(current.valueArea.baselineMm, getVoucherTextBaselineRangeMm(current.valueArea, 12).minBaselineMm);
    await commit("Min. velikost (pt)", "10");
    await settled();
    await commit("X [mm]", "20,3");
    await commit("Y [mm]", "40,2");
    await settled();
    current = requests.at(-1)!.layout;
    assert.equal(current.valueArea.xMm, 23.3);
    assert.ok(Math.abs(current.valueArea.yMm - (102 - 40.2 - 8)) < 1e-10);
    const areaButton = page.getByRole("button", { name: /^Hodnota\. Šipkami/ });
    const beforeNudge = current.valueArea;
    await areaButton.press("ArrowUp");
    await settled();
    current = requests.at(-1)!.layout;
    assert.ok(Math.abs(current.valueArea.yMm - beforeNudge.yMm - 0.1) < 1e-10);
    assert.ok(Math.abs(current.valueArea.baselineMm - beforeNudge.baselineMm - 0.1) < 1e-10);
    await page.getByRole("button", { name: "Na střed svisle" }).click();
    await settled();
    current = requests.at(-1)!.layout;
    assert.equal(current.valueArea.yMm, 48.5);
    assert.ok(Math.abs((current.valueArea.baselineMm - current.valueArea.yMm) - (beforeNudge.baselineMm - beforeNudge.yMm)) < 1e-10);
    const beforeDrag = current.valueArea;
    const box = (await areaButton.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 20, box.y + box.height / 2 + 10, { steps: 4 });
    await page.mouse.up();
    await settled();
    current = requests.at(-1)!.layout;
    assert.notEqual(current.valueArea.yMm, beforeDrag.yMm);
    assert.ok(Math.abs((current.valueArea.baselineMm - current.valueArea.yMm) - (beforeDrag.baselineMm - beforeDrag.yMm)) < 1e-10);
    // A real Rnd corner resize must leave a safe baseline and preserve fonts.
    const corner = areaButton.locator('div[style*="nwse-resize"]').last();
    const cornerBox = (await corner.boundingBox())!;
    await page.mouse.move(cornerBox.x + cornerBox.width / 2, cornerBox.y + cornerBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(cornerBox.x + cornerBox.width / 2 + 10, cornerBox.y + cornerBox.height / 2 - 4, { steps: 4 });
    await page.mouse.up();
    await settled();
    const afterResize = requests.at(-1)!.layout.valueArea;
    assert.notEqual(afterResize.heightMm, current.valueArea.heightMm);
    const range = getVoucherTextBaselineRangeMm(afterResize, 10);
    assert.ok(afterResize.baselineMm >= range.minBaselineMm && afterResize.baselineMm <= range.maxBaselineMm);
    assert.equal(afterResize.typography.preferredFontSizePt, 20);
    assert.equal(afterResize.typography.minFontSizePt, 10);
    await commit("Šířka [mm]", "4");
    await expect(page.getByRole("alert")).toContainText("Hodnota se nevejde do vybrané oblasti. Zvětšete oblast nebo snižte minimální velikost písma.");
    await expect(page.getByRole("alert")).not.toContainText(/422|stack|text_overflow/);
    const failedCount = requests.length;
    // Drag start/stop changes effect dependencies even with unchanged geometry.
    const failedBox = (await areaButton.boundingBox())!;
    await page.mouse.move(failedBox.x + failedBox.width / 2, failedBox.y + failedBox.height / 2);
    await page.mouse.down();
    await page.mouse.up();
    await page.getByLabel("Zvětšení náhledu voucheru").selectOption("1.5");
    await page.waitForTimeout(600);
    assert.equal(requests.length, failedCount, "stejný overflow nesmí vyvolat další request");
    await page.getByLabel("Typ náhledu voucheru").selectOption("SERVICE");
    await expect.poll(() => requests.length).toBe(failedCount + 1);
    await settled();
    await page.getByLabel("Typ náhledu voucheru").selectOption("VALUE");
    await expect.poll(() => requests.length).toBe(failedCount + 2);
    await expect(page.getByRole("alert")).toContainText("Hodnota se nevejde");
    await commit("Šířka [mm]", "130");
    await settled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    assert.equal(requests.at(-1)!.overflowed, false);
    const beforeTooShort = requests.length;
    await commit("Výška [mm]", "0,5");
    await expect(page.getByRole("alert")).toContainText("Oblast „Hodnota“ je příliš nízká i pro minimální velikost písma.");
    await expect(page.getByRole("button", { name: "Uložit změny" })).toBeDisabled();
    await page.waitForTimeout(400);
    assert.equal(requests.length, beforeTooShort);
    await commit("Výška [mm]", "8");
    await settled();
    await expect(page.getByRole("alert")).toHaveCount(0);
    assert.deepEqual(requests.at(-1)!.layout.qrArea, defaultVoucherTemplateLayout.qrArea);
    assert.deepEqual(browserErrors, []);
  } finally {
    await browser.close();
  }
});
