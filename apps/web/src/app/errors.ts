export type ApplicationErrorCode =
  | "storage-unavailable"
  | "initialization-failed"
  | "quota-exceeded"
  | "conflict"
  | "not-found"
  | "invalid-data"
  | "operation-failed"
  | "unexpected";

interface ErrorPresentation {
  readonly title: string;
  readonly message: string;
  readonly retryable: boolean;
}

const ERROR_PRESENTATIONS: Record<ApplicationErrorCode, ErrorPresentation> = {
  "storage-unavailable": {
    title: "Local storage is unavailable",
    message:
      "Dues needs this browser's local storage to keep your payment data on this device.",
    retryable: true,
  },
  "initialization-failed": {
    title: "Dues could not open your local data",
    message: "Your data has not been changed. Try opening local storage again.",
    retryable: true,
  },
  "quota-exceeded": {
    title: "This device is out of storage space",
    message: "Free some browser storage before trying this operation again.",
    retryable: true,
  },
  conflict: {
    title: "This payment changed",
    message: "Reload the latest record before applying your change again.",
    retryable: true,
  },
  "not-found": {
    title: "Payment not found",
    message: "The payment may have been archived or deleted in another view.",
    retryable: false,
  },
  "invalid-data": {
    title: "Check the entered details",
    message: "One or more values are not valid for a recurring payment.",
    retryable: false,
  },
  "operation-failed": {
    title: "The operation could not be completed",
    message: "Your existing local data has not been changed. Please try again.",
    retryable: true,
  },
  unexpected: {
    title: "Dues ran into a problem",
    message:
      "Your existing local data has not been changed. Close this message and try again.",
    retryable: true,
  },
};

export class ApplicationError extends Error {
  readonly code: ApplicationErrorCode;

  constructor(code: ApplicationErrorCode) {
    super(ERROR_PRESENTATIONS[code].message);
    this.name = "ApplicationError";
    this.code = code;
  }
}

export function toApplicationError(error: unknown): ApplicationError {
  return error instanceof ApplicationError
    ? error
    : new ApplicationError("unexpected");
}

export function presentApplicationError(
  error: ApplicationError,
): ErrorPresentation {
  return ERROR_PRESENTATIONS[error.code];
}
