export type StorageErrorCode =
  | "unavailable"
  | "initialization"
  | "quota"
  | "transaction"
  | "duplicate"
  | "conflict"
  | "not-found"
  | "invalid-data";

const DISPLAY_MESSAGES: Record<StorageErrorCode, string> = {
  unavailable: "Local storage is unavailable in this browser.",
  initialization: "Local storage could not be opened.",
  quota: "This device does not have enough storage space.",
  transaction: "The local data change could not be completed.",
  duplicate: "A payment with this ID already exists.",
  conflict: "This payment changed since it was last loaded.",
  "not-found": "The requested payment was not found.",
  "invalid-data": "The local data change is invalid.",
};

export class StorageError extends Error {
  readonly code: StorageErrorCode;
  readonly cause?: unknown;

  constructor(code: StorageErrorCode, options?: { readonly cause?: unknown }) {
    super(DISPLAY_MESSAGES[code]);
    this.name = "StorageError";
    this.code = code;
    if (options && "cause" in options) this.cause = options.cause;
  }
}

export function toStorageError(error: unknown, fallback: StorageErrorCode): StorageError {
  if (error instanceof StorageError) return error;
  const name = error instanceof Error ? error.name : "";
  if (name === "QuotaExceededError") return new StorageError("quota", { cause: error });
  if (name === "ConstraintError") return new StorageError("duplicate", { cause: error });
  if (name === "DatabaseClosedError" || name === "MissingAPIError") {
    return new StorageError("unavailable", { cause: error });
  }
  return new StorageError(fallback, { cause: error });
}
