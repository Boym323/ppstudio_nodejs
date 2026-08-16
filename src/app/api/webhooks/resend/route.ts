import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { applyResendWebhookEvent, verifyResendWebhookPayload } from "@/lib/email/resend-webhooks";

function readWebhookHeaders(request: Request) {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");

  if (!id || !timestamp || !signature) {
    return null;
  }

  return { id, timestamp, signature };
}

export async function POST(request: Request) {
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ status: "disabled" }, { status: 503 });
  }

  const headers = readWebhookHeaders(request);

  if (!headers) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const payload = await request.text();

  let event;

  try {
    event = await verifyResendWebhookPayload({
      payload,
      headers,
      webhookSecret: env.RESEND_WEBHOOK_SECRET,
    });
  } catch (error) {
    console.error("Resend webhook verification failed", { error });

    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  try {
    console.info("Resend webhook received", {
      eventType: event.type,
      providerEventId: headers.id,
      providerMessageId: event.data?.email_id?.trim() || null,
    });

    const result = await applyResendWebhookEvent({ event, providerEventId: headers.id });

    console.info(result.duplicate ? "Resend webhook duplicate ignored" : "Resend webhook processed", {
      eventType: event.type,
      providerEventId: headers.id,
      providerMessageId: event.data?.email_id?.trim() || null,
      matched: result.matched,
      ignored: result.ignored,
    });

    return NextResponse.json({
      status: "ok",
      matched: result.matched,
      ignored: result.ignored,
    });
  } catch (error) {
    console.error("Resend webhook processing failed", {
      eventType: event.type,
      providerEventId: headers.id,
      providerMessageId: event.data?.email_id?.trim() || null,
      error,
    });

    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
