import { z } from "zod";
import path from "node:path";

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default("PP Studio"),
    NEXT_PUBLIC_APP_URL: z.url(),
    DATABASE_URL: z.string().min(1),
    ADMIN_SESSION_SECRET: z.string().min(32),
    ADMIN_OWNER_EMAIL: z.email(),
    ADMIN_OWNER_PASSWORD: z.string().min(8),
    ADMIN_STAFF_EMAIL: z.email(),
    ADMIN_STAFF_PASSWORD: z.string().min(8),
    EMAIL_DELIVERY_MODE: z.enum(["log", "background"]).default("log"),
    SMTP_HOST: z.string().trim().optional(),
    SMTP_PORT: z.coerce.number().int().positive().optional(),
    SMTP_SECURE: z.enum(["auto", "true", "false"]).default("auto"),
    SMTP_USER: z.string().trim().optional(),
    SMTP_PASSWORD: z.string().trim().optional(),
    SMTP_FROM_EMAIL: z.email().optional(),
    SMTP_FROM_NAME: z.string().trim().min(1).default("PP Studio"),
    SMTP_REPLY_TO: z.email().optional(),
    MEDIA_STORAGE_ROOT: z.string().trim().optional(),
  })
  .superRefine((env, context) => {
    if (env.EMAIL_DELIVERY_MODE !== "background") {
      return;
    }

    const requiredFields = [
      ["SMTP_HOST", env.SMTP_HOST],
      ["SMTP_PORT", env.SMTP_PORT],
      ["SMTP_USER", env.SMTP_USER],
      ["SMTP_PASSWORD", env.SMTP_PASSWORD],
      ["SMTP_FROM_EMAIL", env.SMTP_FROM_EMAIL],
    ] as const;

    for (const [field, value] of requiredFields) {
      if (value === undefined || value === "") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} je povinné, když EMAIL_DELIVERY_MODE=background.`,
        });
      }
    }
  });

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables.");
}

export const env = parsed.data;

export const mediaStorageRoot =
  env.MEDIA_STORAGE_ROOT && env.MEDIA_STORAGE_ROOT.length > 0
    ? path.resolve(env.MEDIA_STORAGE_ROOT)
    : path.resolve(/* turbopackIgnore: true */ process.cwd(), "..", "ppstudio-uploads");
