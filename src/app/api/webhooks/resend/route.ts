import { NextResponse } from "next/server";

import { env } from "@/config/env";
import { applyResendWebhookEvent, verifyResendWebhookPayload } from "@/lib/email/resend-webhooks";

export const RESEND_WEBHOOK_MAX_BODY_BYTES = 256 * 1024;

class RequestBodyTooLargeError extends Error {}

export async function readBoundedRawBody(
  request: Request,
  maxBytes = RESEND_WEBHOOK_MAX_BODY_BYTES,
) {
  const contentLength = request.headers.get("content-length")?.trim();

  if (contentLength && /^\d+$/.test(contentLength)) {
    if (BigInt(contentLength) > BigInt(maxBytes)) {
      throw new RequestBodyTooLargeError();
    }
  }

  if (!request.body) {
    return Buffer.alloc(0);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      totalBytes += value.byteLength;

      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }

      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

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

  let payload: Buffer;

  try {
    payload = await readBoundedRawBody(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return NextResponse.json({ status: "too_large" }, { status: 413 });
    }

    console.error("Resend webhook body read failed", { error });
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

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
