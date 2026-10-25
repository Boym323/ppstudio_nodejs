import "dotenv/config";
import { stdin } from "node:process";
import { assertDevBootstrapAllowed, DEV_ADMIN_EMAIL, DEV_ADMIN_ID } from "../src/lib/auth/dev-bootstrap";

async function main() {
  // Ověření musí proběhnout ještě před importem Prisma a před čtením hesla.
  assertDevBootstrapAllowed(process.env);
  if (stdin.isTTY) throw new Error("Testovací heslo předejte přes stdin, ne argumentem příkazu.");
  let password = "";
  for await (const chunk of stdin) password += chunk;
  password = password.trimEnd();
  if (password.length < 12) throw new Error("DEV heslo musí mít alespoň 12 znaků.");
  const [{ prisma }, { hashPassword }] = await Promise.all([import("../src/lib/prisma"), import("../src/lib/auth/password")]);
  try {
    const data = { email: DEV_ADMIN_EMAIL, name: "DEV testovací planner", role: "OWNER" as const, passwordHash: await hashPassword(password), isActive: true };
    // Pevné ID a vyhrazený e-mail zabrání přepsání běžného účtu.
    await prisma.adminUser.upsert({ where: { id: DEV_ADMIN_ID }, create: { id: DEV_ADMIN_ID, ...data }, update: data });
    console.info(`DEV účet připraven: ${DEV_ADMIN_EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "DEV bootstrap selhal.");
  process.exitCode = 1;
});
