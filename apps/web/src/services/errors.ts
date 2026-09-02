import { StorageError } from "@dues/storage";
import { ApplicationError } from "../app/index";

const STORAGE_ERROR_CODES = {
  unavailable: "storage-unavailable",
  initialization: "initialization-failed",
  quota: "quota-exceeded",
  transaction: "operation-failed",
  duplicate: "conflict",
  conflict: "conflict",
  "not-found": "not-found",
  "invalid-data": "invalid-data",
} as const;

export function toServiceError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) return error;
  if (error instanceof StorageError) {
    return new ApplicationError(STORAGE_ERROR_CODES[error.code]);
  }
  if (
    error instanceof TypeError ||
    error instanceof RangeError ||
    (error instanceof Error && error.name === "ZodError")
  ) {
    return new ApplicationError("invalid-data");
  }
  return new ApplicationError("operation-failed");
}

export async function runServiceOperation<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw toServiceError(error);
  }
}
