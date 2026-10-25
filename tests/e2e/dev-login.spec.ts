import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { expect, test } from "@playwright/test";
import { DEV_ADMIN_EMAIL, DEV_ADMIN_ID } from "../../src/lib/auth/dev-bootstrap";
import { prisma } from "../../src/lib/prisma";

function bootstrap(password: string, nodeEnv: "development" | "production") {
  return new Promise<number | null>((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", "tsx", "scripts/bootstrap-dev-admin.ts"], {
      env: { ...process.env, NODE_ENV: nodeEnv, PPSTUDIO_DEV_BOOTSTRAP: "1" },
      stdio: ["pipe", "ignore", "pipe"],
    });
    child.stdin.on("error", () => {}); // produkční guard může zavřít stdin ihned
    child.stdin.end(`${password}\n`);
    child.on("error", reject);
    child.on("exit", resolve);
  });
}

test("DEV bootstrap je opakovatelný, přihlásí testovací účet a odmítá produkci", async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(test.info().project.name !== "chromium", "DEV offline bootstrap.");
  const url = new URL(process.env.DATABASE_URL!);
  expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
  expect(url.pathname).toMatch(/_test$/);
  const password = randomBytes(24).toString("base64url");
  try {
    expect(await bootstrap(password, "production")).toBe(1);
    expect(await bootstrap(password, "development")).toBe(0);
    expect(await bootstrap(password, "development")).toBe(0);
    await page.goto("/admin/prihlaseni");
    await page.getByLabel("E-mail").fill(DEV_ADMIN_EMAIL);
    await page.getByLabel("Heslo").fill(password);
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    await expect(page).toHaveURL(/\/admin(?:\?.*)?$/);
  } finally {
    await prisma.adminUser.deleteMany({ where: { id: DEV_ADMIN_ID, email: DEV_ADMIN_EMAIL } });
  }
});
