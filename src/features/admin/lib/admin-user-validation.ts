import { z } from "zod";

export const adminUserRoleValues = ["OWNER", "SALON"] as const;

export const saveAdminUserSchema = z.object({
  userId: z.string().trim().max(64).optional().or(z.literal("")),
  name: z.string().trim().min(1, "Doplňte jméno.").max(120, "Jméno je příliš dlouhé."),
  email: z.email("Zadejte platný e-mail.").max(160, "E-mail je příliš dlouhý."),
  role: z.enum(adminUserRoleValues, {
    error: "Vyberte roli.",
  }),
});

export const changeAdminUserRoleSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  role: z.enum(adminUserRoleValues),
});

export const setAdminUserActiveSchema = z.object({
  userId: z.string().trim().min(1).max(64),
  nextIsActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const resendAdminUserInviteSchema = z.object({
  userId: z.string().trim().min(1).max(64),
});

export type AdminUserRoleValue = (typeof adminUserRoleValues)[number];
