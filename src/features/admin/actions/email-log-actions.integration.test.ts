import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import { EmailAudience, EmailLogStatus, EmailLogType } from "@/generated/prisma/browser";

process.env.NEXT_PUBLIC_APP_NAME ??= "PP Studio";
process.env.NEXT_PUBLIC_APP_URL ??= "https://example.com";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/ppstudio?schema=public";
process.env.ADMIN_SESSION_SECRET ??= "test-secret-value-with-at-least-32-chars";
process.env.EMAIL_DELIVERY_MODE ??= "log";

const dbTest = process.env.RUN_DB_INTEGRATION_TESTS === "1" ? test : test.skip;

dbTest("resend action založí CLIENT resend na aktuální změněný e-mail klientky", async () => {
  const [{ prisma }, { createResendEmailLog }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/actions/email-log-resend"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const oldEmail = `puvodni-${suffix}@example.test`;
  const newEmail = `nova-${suffix}@example.test`;
  const client = await prisma.client.create({
    data: { fullName: `Klientka resend ${suffix}`, email: oldEmail },
  });
  const source = await prisma.emailLog.create({
    data: {
      clientId: client.id,
      type: EmailLogType.GENERIC,
      audience: EmailAudience.CLIENT,
      status: EmailLogStatus.FAILED,
      recipientEmail: oldEmail,
      subject: "Test resend",
      templateKey: "test-resend",
    },
  });

  try {
    await prisma.client.update({ where: { id: client.id }, data: { email: newEmail } });
    const sourceForResend = await prisma.emailLog.findUniqueOrThrow({
      where: { id: source.id },
      include: {
        client: { select: { id: true, email: true } },
        booking: { select: { id: true, clientEmailSnapshot: true } },
      },
    });

    const resend = await createResendEmailLog({ emailLog: sourceForResend });

    assert.ok(resend);
    assert.equal(resend.recipientEmail, newEmail);
    assert.equal(resend.resendOfId, source.id);
  } finally {
    await prisma.emailLog.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
});

dbTest("resend action odmítne CLIENT resend bez aktuálního e-mailu a snapshotu", async () => {
  const [{ prisma }, { createResendEmailLog }] = await Promise.all([
    import("@/lib/prisma"),
    import("@/features/admin/actions/email-log-resend"),
  ]);
  const suffix = randomUUID().slice(0, 8);
  const historicalEmail = `historicky-${suffix}@example.test`;
  const client = await prisma.client.create({
    data: { fullName: `Klientka bez e-mailu ${suffix}`, email: historicalEmail },
  });
  const source = await prisma.emailLog.create({
    data: {
      clientId: client.id,
      type: EmailLogType.GENERIC,
      audience: EmailAudience.CLIENT,
      status: EmailLogStatus.FAILED,
      recipientEmail: historicalEmail,
      subject: "Test odstraněného e-mailu",
      templateKey: "test-resend",
    },
  });

  try {
    await prisma.client.update({ where: { id: client.id }, data: { email: null } });
    const sourceForResend = await prisma.emailLog.findUniqueOrThrow({
      where: { id: source.id },
      include: {
        client: { select: { id: true, email: true } },
        booking: { select: { id: true, clientEmailSnapshot: true } },
      },
    });

    const resend = await createResendEmailLog({ emailLog: sourceForResend });

    assert.equal(resend, null);
    assert.equal(await prisma.emailLog.count({ where: { resendOfId: source.id } }), 0);
  } finally {
    await prisma.emailLog.deleteMany({ where: { clientId: client.id } });
    await prisma.client.delete({ where: { id: client.id } });
  }
});
