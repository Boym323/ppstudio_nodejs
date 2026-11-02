import "dotenv/config";

import { BookingStatus, EmailLogStatus, Prisma } from "@/generated/prisma/client";
import { env } from "@/config/env";
import { prisma } from "@/lib/prisma";
import { mergeClientProfiles } from "@/features/admin/lib/client-merge";
import { loadClientMergePreview } from "@/features/admin/lib/client-merge-preview";

type Arguments = {
  sourceClientId?: string;
  targetClientId?: string;
  bookingId?: string;
  sourceEmail?: string;
  targetEmail?: string;
  apply: boolean;
  confirmApply: boolean;
  confirmDatabaseHost?: string;
  nameChoice?: string;
  phoneChoice?: string;
  confirmPreview?: string;
};

function parseArguments(values: string[]): Arguments {
  const args: Arguments = { apply: false, confirmApply: false };
  const valueAfter = (flag: string) => {
    const index = values.indexOf(flag);
    return index === -1 ? undefined : values[index + 1];
  };

  args.sourceClientId = valueAfter("--source-client-id");
  args.targetClientId = valueAfter("--target-client-id");
  args.bookingId = valueAfter("--booking-id");
  args.sourceEmail = valueAfter("--source-email");
  args.targetEmail = valueAfter("--target-email");
  args.confirmDatabaseHost = valueAfter("--confirm-database-host");
  args.nameChoice = valueAfter("--name-choice");
  args.phoneChoice = valueAfter("--phone-choice");
  args.confirmPreview = valueAfter("--confirm-preview");
  args.apply = values.includes("--apply");
  args.confirmApply = values.includes("--confirm-apply");

  const recognized = new Set([
    "--source-client-id", "--target-client-id", "--booking-id", "--source-email",
    "--target-email", "--confirm-database-host", "--name-choice", "--phone-choice", "--confirm-preview", "--apply", "--confirm-apply",
  ]);
  for (let index = 0; index < values.length; index += 1) {
    if (!recognized.has(values[index])) throw new Error(`Neznámý argument: ${values[index]}`);
    if (values[index].startsWith("--") && !["--apply", "--confirm-apply"].includes(values[index])) index += 1;
  }
  return args;
}

function normalizedEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function requireArguments(args: Arguments): asserts args is Arguments & {
  sourceClientId: string;
  targetClientId: string;
  bookingId: string;
  sourceEmail: string;
  targetEmail: string;
} {
  if (!args.sourceClientId || !args.targetClientId || !args.bookingId || !args.sourceEmail || !args.targetEmail) {
    throw new Error(
      "Použití: npm run db:merge-duplicate-client -- --source-client-id <ID> --target-client-id <ID> --booking-id <ID> --source-email <adresa> --target-email <adresa> [--apply --confirm-apply --confirm-database-host <host> --confirm-preview <otisk> --name-choice source|target --phone-choice source|target]",
    );
  }
  if (args.sourceClientId === args.targetClientId) throw new Error("Zdrojový a cílový profil musí být různé.");
}

async function inspectMerge(args: Required<Pick<Arguments,
  "sourceClientId" | "targetClientId" | "bookingId" | "sourceEmail" | "targetEmail"
>>, db: typeof prisma | Prisma.TransactionClient = prisma) {
  const source = await db.client.findUnique({
      where: { id: args.sourceClientId },
      include: {
        bookings: { select: { id: true } },
        emailLogs: { select: { id: true, bookingId: true, status: true, audience: true, recipientEmail: true } },
        submissionLogs: { select: { id: true, bookingId: true } },
      },
  });
  const target = await db.client.findUnique({ where: { id: args.targetClientId } });
  const booking = await db.booking.findUnique({
      where: { id: args.bookingId },
      include: {
        emailLogs: { select: { id: true, clientId: true, status: true, audience: true, recipientEmail: true, processingStartedAt: true } },
        actionTokens: { select: { type: true, usedAt: true, revokedAt: true, expiresAt: true } },
      },
  });

  const problems: string[] = [];
  if (!source) problems.push("Zdrojový klientský profil neexistuje.");
  if (!target) problems.push("Cílový klientský profil neexistuje.");
  if (!booking) problems.push("Rezervace neexistuje.");
  if (!source || !target || !booking) throw new Error(problems.join(" "));

  const now = new Date();
  if (normalizedEmail(source.email) !== normalizedEmail(args.sourceEmail)) problems.push("E-mail zdrojového profilu neodpovídá očekávané adrese.");
  if (normalizedEmail(target.email) !== normalizedEmail(args.targetEmail)) problems.push("E-mail cílového profilu neodpovídá očekávané adrese.");
  if (!target.isActive || !source.isActive) problems.push("Oba profily musí být aktivní.");
  if (booking.clientId !== source.id) problems.push("Rezervace už není připojena ke zdrojovému profilu.");
  if (booking.status !== BookingStatus.CONFIRMED && booking.status !== BookingStatus.PENDING) problems.push("Přesunout lze pouze aktivní rezervaci PENDING nebo CONFIRMED.");
  if (booking.scheduledStartsAt <= now) problems.push("Rezervace již nezačíná v budoucnosti.");
  if (normalizedEmail(booking.clientEmailSnapshot) !== normalizedEmail(source.email)) problems.push("E-mailový snapshot rezervace se liší od zdrojového profilu.");
  if (source.bookings.length !== 1 || source.bookings[0]?.id !== booking.id) problems.push("Zdrojový profil obsahuje další rezervace; tento jednoúčelový merge je odmítnut.");
  if (source.submissionLogs.length !== 0) problems.push("Zdrojový profil má submission logy; jejich převod vyžaduje samostatnou kontrolu.");
  if (source.emailLogs.some((log) => log.bookingId !== booking.id)) problems.push("Zdrojový profil obsahuje e-mailové logy mimo převáděnou rezervaci.");
  if (booking.emailLogs.some((log) => log.status === EmailLogStatus.PENDING || log.processingStartedAt !== null)) problems.push("Rezervace má e-mail ve frontě nebo právě zpracovávaný; merge se nesmí provést souběžně s workerem.");
  if (booking.clientDeliveryLeaseExpiresAt && booking.clientDeliveryLeaseExpiresAt > now) problems.push("Rezervace má aktivní lease e-mailového workeru.");
  if (!target.email) problems.push("Cílový profil nemá e-mailovou adresu.");

  return {
    source,
    target,
    booking,
    problems,
    summary: {
      databaseHost: new URL(env.DATABASE_URL).hostname,
      source: { id: source.id, fullName: source.fullName, email: source.email, phone: source.phone, bookingCount: source.bookings.length, emailLogCount: source.emailLogs.length },
      target: {
        id: target.id,
        fullName: target.fullName,
        email: target.email,
        phone: target.phone,
        bookingCount: await db.booking.count({ where: { clientId: target.id } }),
      },
      booking: {
        id: booking.id,
        status: booking.status,
        service: booking.serviceNameSnapshot,
        scheduledStartsAt: booking.scheduledStartsAt.toISOString(),
        communicationGeneration: booking.communicationGeneration,
        emailLogs: booking.emailLogs.map((log) => ({ status: log.status, audience: log.audience, recipientEmail: log.recipientEmail })),
        activeActionTokenCount: booking.actionTokens.filter((token) => !token.usedAt && !token.revokedAt && token.expiresAt > now).length,
      },
      effect: [
        "Připojit rezervaci k cílovému profilu a propsat jeho e-mail a zvolený telefon.",
        "Při aplikaci výslovně vybrat jméno a telefon ze zdrojového nebo cílového profilu.",
        "Převést navázané e-mailové záznamy bez změny jejich příjemce nebo doručovacího stavu.",
        "Obnovit aktivní klientské akční tokeny a připravit aktuální potvrzení rezervace.",
        "Archivovat duplicitní profil: deaktivovat jej a uvolnit chybnou e-mailovou adresu.",
        "Zapsat sloučení do historie rezervace.",
      ],
    },
  };
}

async function applyMerge(args: Required<Pick<Arguments,
  "sourceClientId" | "targetClientId" | "bookingId" | "sourceEmail" | "targetEmail"
>>, nameChoice: "source" | "target", phoneChoice: "source" | "target", expectedFingerprint: string) {
  return mergeClientProfiles({
    sourceClientId: args.sourceClientId,
    targetClientId: args.targetClientId,
    actorUserId: null,
    expectedSourceEmail: args.sourceEmail,
    expectedTargetEmail: args.targetEmail,
    expectedFingerprint,
    nameChoice,
    phoneChoice,
  });
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  requireArguments(args);
  const { inspected, preview } = await prisma.$transaction(async (tx) => ({
    inspected: await inspectMerge(args, tx),
    preview: await loadClientMergePreview(args.sourceClientId, args.targetClientId, tx),
  }), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (!preview) throw new Error("Profily se změnily; náhled už nelze použít.");
  console.log(JSON.stringify({ ...inspected.summary, previewFingerprint: preview.fingerprint }, null, 2));
  if (inspected.problems.length > 0) {
    throw new Error(`Náhled merge odmítnut:\n- ${inspected.problems.join("\n- ")}`);
  }

  if (!args.apply) {
    console.info("NÁHLED: databáze nebyla změněna. Pro aplikaci na dev předejte zobrazený otisk přes --confirm-preview, potvrďte host a výslovně zvolte jméno a telefon.");
    return;
  }

  const databaseHost = new URL(env.DATABASE_URL).hostname;
  if (!args.confirmApply || args.confirmDatabaseHost !== databaseHost) {
    throw new Error("Aplikace vyžaduje --confirm-apply a přesné --confirm-database-host shodné s vypsaným hostem databáze.");
  }
  if (args.confirmPreview !== preview.fingerprint) throw new Error("Otisk náhledu nesouhlasí. Zkontrolujte aktuální náhled a potvrďte jej znovu.");
  if (env.NODE_ENV === "production" || env.EMAIL_DELIVERY_MODE !== "log") {
    throw new Error("Aplikace je povolena pouze mimo production a s EMAIL_DELIVERY_MODE=log; žádné skutečné e-maily nesmějí být odeslány.");
  }

  if ((args.nameChoice !== "source" && args.nameChoice !== "target") || (args.phoneChoice !== "source" && args.phoneChoice !== "target")) {
    throw new Error("Při aplikaci výslovně zvolte --name-choice source|target a --phone-choice source|target.");
  }

  const result = await applyMerge(args, args.nameChoice, args.phoneChoice, preview.fingerprint);
  console.info(JSON.stringify({ applied: true, ...result }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Sloučení klientských profilů selhalo.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
