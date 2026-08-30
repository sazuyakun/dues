export const BACKUP_FORMAT = "dues-backup" as const;
export const CURRENT_BACKUP_VERSION = 1 as const;
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
export const MAX_BACKUP_RECORDS = 10_000;

export type CalendarDate = `${number}-${number}-${number}`;
export type PaymentId = string;
export type MinorUnitAmount = number;
export type PaymentStatus = "active" | "paused" | "archived";

export type Recurrence =
  | { frequency: "weekly" }
  | { frequency: "monthly"; anchorDay: number }
  | { frequency: "quarterly"; anchorDay: number }
  | { frequency: "yearly"; anchorMonth: number; anchorDay: number }
  | {
      frequency: "custom";
      interval:
        | { count: number; unit: "day" }
        | { count: number; unit: "week" }
        | { count: number; unit: "month"; anchorDay: number }
        | {
            count: number;
            unit: "year";
            anchorMonth: number;
            anchorDay: number;
          };
    };

/** The structural recurrence accepted from @dues/core before wire projection. */
export type CanonicalRecurrence =
  | { frequency: "weekly" }
  | { frequency: "monthly"; anchorDay?: number | undefined }
  | { frequency: "quarterly"; anchorDay?: number | undefined }
  | {
      frequency: "yearly";
      anchorMonth?: number | undefined;
      anchorDay?: number | undefined;
    }
  | {
      frequency: "custom";
      interval:
        | { count: number; unit: "day" }
        | { count: number; unit: "week" }
        | { count: number; unit: "month"; anchorDay?: number | undefined }
        | {
            count: number;
            unit: "year";
            anchorMonth?: number | undefined;
            anchorDay?: number | undefined;
          };
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

/**
 * Structural subset of the canonical core payment used at the export boundary.
 * Storage records may carry additional metadata, which projection discards.
 */
export interface CanonicalPayment {
  id: PaymentId;
  name: string;
  amount: MinorUnitAmount;
  currency: string;
  recurrence: CanonicalRecurrence;
  nextDueDate: CalendarDate;
  status: PaymentStatus;
  category?: string | undefined;
  paymentMethodLabel?: string | undefined;
  freeTrialEndDate?: CalendarDate | undefined;
  notes?: string | undefined;
  providerUrl?: string | undefined;
  reminderLeadDays?: number | undefined;
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
