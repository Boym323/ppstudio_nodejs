import "dotenv/config";
import { stdin } from "node:process";

type Arguments = {
  email?: string;
  name?: string;
  confirm: boolean;
};

function parseArguments(values: string[]): Arguments {
  const result: Arguments = { confirm: false };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (value === "--confirm") result.confirm = true;
    if (value === "--email") result.email = values[index + 1];
    if (value === "--name") result.name = values[index + 1];
  }

  return result;
}

async function readPassword() {
  if (stdin.isTTY) {
    throw new Error("Heslo předejte přes stdin, například: < /bezpecna/cesta/heslo.txt");
  }

  let input = "";
  for await (const chunk of stdin) input += chunk;
  return input.trimEnd();
}

async function main() {
  const args = parseArguments(process.argv.slice(2));

  if (!args.confirm || !args.email || !args.name) {
    console.error(
      "Použití: npm run admin:recover-owner -- --email owner@example.com --name 'Jméno' --confirm < heslo.txt",
    );
    process.exitCode = 2;
  } else {
    const password = await readPassword().catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : "Heslo se nepodařilo načíst.");
      process.exitCode = 2;
      return "";
    });

    if (password.length < 12) {
      console.error("Recovery heslo musí mít alespoň 12 znaků.");
      process.exitCode = 2;
    } else {
      const { recoverAdminOwner } = await import("@/lib/auth/admin-recovery");
      const user = await recoverAdminOwner({ email: args.email, name: args.name, password });
      console.info(`AUDIT ADMIN_RECOVERY_OWNER_RESTORED adminUserId=${user.id} email=${user.email}`);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Recovery selhala.");
  process.exitCode = 1;
});
