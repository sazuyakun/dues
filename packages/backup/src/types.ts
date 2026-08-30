export const BACKUP_FORMAT = "dues-backup" as const;
export const CURRENT_BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 10_000;

export type CalendarDate = `${number}-${number}-${number}`;
export type PaymentId = string;
export type MinorUnitAmount = number;
export type PaymentStatus = "active" | "paused" | "archived";

export type Recurrence =
  | { type: "weekly" }
  | { type: "monthly" }
  | { type: "quarterly" }
  | { type: "yearly" }
  | {
      type: "custom";
      interval: number;
      unit: "days" | "weeks" | "months" | "years";
    };

export interface BackupPayment {
  id: PaymentId;
  name: string;
  amount: MinorUnitAmount;
  currency: string;
  recurrence: Recurrence;
  nextDueDate: CalendarDate;
  status: PaymentStatus;
  category?: string;
  paymentMethodLabel?: string;
  freeTrialEndDate?: CalendarDate;
  notes?: string;
  providerUrl?: string;
  reminderLeadDays?: number;
}

export interface BackupEnvelope {
  format: typeof BACKUP_FORMAT;
  version: typeof CURRENT_BACKUP_VERSION;
  exportedAt: string;
  payments: BackupPayment[];
}

export type ValidationErrorCode =
  | "file_too_large"
  | "malformed_json"
  | "invalid_envelope"
  | "unsupported_version"
  | "too_many_records"
  | "duplicate_id"
  | "invalid_record";

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  path?: string;
  recordIndex?: number;
}

export type ValidationResult<T> =
  { ok: true; value: T } | { ok: false; errors: ValidationError[] };

export interface InvalidImportRecord {
  index: number;
  errors: ValidationError[];
}

export interface ImportPreview {
  envelope: Omit<BackupEnvelope, "payments">;
  validRecords: BackupPayment[];
  invalidRecords: InvalidImportRecord[];
  newRecords: BackupPayment[];
  conflicts: BackupPayment[];
}

export type MergeImportPlan =
  | { mode: "merge"; ready: false; invalidRecords: InvalidImportRecord[] }
  | {
      mode: "merge";
      ready: true;
      inserts: BackupPayment[];
      conflicts: BackupPayment[];
    };

export type ReplacementImportPlan =
  | { mode: "replace"; ready: false; invalidRecords: InvalidImportRecord[] }
  | { mode: "replace"; ready: true; records: BackupPayment[] };
