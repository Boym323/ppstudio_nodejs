import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("PP Studio"),
  NEXT_PUBLIC_APP_URL: z.url(),
  DATABASE_URL: z.string().min(1),
  ADMIN_SESSION_SECRET: z.string().min(32),
  ADMIN_OWNER_EMAIL: z.email(),
  ADMIN_OWNER_PASSWORD: z.string().min(8),
  ADMIN_STAFF_EMAIL: z.email(),
  ADMIN_STAFF_PASSWORD: z.string().min(8),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables", parsed.error.flatten().fieldErrors);
  throw new Error("Invalid environment variables.");
}

export const env = parsed.data;
