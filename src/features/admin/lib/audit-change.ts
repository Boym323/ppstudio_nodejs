import { Prisma } from "@prisma/client";

export type AuditScalar = string | number | boolean | null | string[];
export type AuditSnapshot = Record<string, AuditScalar>;

function auditValueEquals(left: AuditScalar, right: AuditScalar) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Vrátí pouze skutečně změněná, předem vybraná bezpečná pole. */
export function buildAuditChange(beforeValues: AuditSnapshot, afterValues: AuditSnapshot) {
  const before: AuditSnapshot = {};
  const after: AuditSnapshot = {};

  for (const key of Object.keys(afterValues)) {
    if (!auditValueEquals(beforeValues[key] ?? null, afterValues[key] ?? null)) {
      before[key] = beforeValues[key] ?? null;
      after[key] = afterValues[key] ?? null;
    }
  }

  if (Object.keys(after).length === 0) {
    return null;
  }

  return {
    before: before as Prisma.InputJsonObject,
    after: after as Prisma.InputJsonObject,
  };
}
