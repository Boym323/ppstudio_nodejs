export type TransientTransactionConflictKind =
  | "serialization_failure"
  | "deadlock"
  | "advisory_lock_busy";

export class TransientTransactionConflictError extends Error {
  constructor(readonly kind: TransientTransactionConflictKind, message = "Transient transaction conflict.") {
    super(message);
    this.name = "TransientTransactionConflictError";
  }
}
