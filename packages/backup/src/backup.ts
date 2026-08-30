import type { z, ZodError, ZodIssue } from "zod";
import { backupPaymentSchema, envelopeHeaderSchema } from "./schema";
import {
  BACKUP_FORMAT,
  CURRENT_BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_RECORDS,
  type BackupEnvelope,
  type BackupPayment,
  type ImportPreview,
  type InvalidImportRecord,
  type MergeImportPlan,
  type ReplacementImportPlan,
  type ValidationError,
  type ValidationResult,
} from "./types";

type EnvelopeHeader = z.infer<typeof envelopeHeaderSchema>;
type IndexedPayment = { index: number; value: BackupPayment };

const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

const safeIssueMessage = (issue: ZodIssue): string => {
  switch (issue.code) {
    case "custom":
      return issue.message;
    case "invalid_type":
      return issue.received === "undefined" ? "Required field is missing" : "Value has an invalid type";
    case "invalid_enum_value":
    case "invalid_literal":
    case "invalid_union":
    case "invalid_union_discriminator":
      return "Value is not supported";
    case "invalid_string":
      return "String has an invalid format";
    case "too_small":
      return "Value is below the allowed minimum";
    case "too_big":
      return "Value exceeds the allowed maximum";
    case "unrecognized_keys":
      return "Object contains unexpected properties";
    default:
      return "Value is invalid";
  }
};

const zodErrors = (error: ZodError, code: "invalid_envelope" | "invalid_record"): ValidationError[] =>
  error.issues.map((issue) => ({
    code,
    message: safeIssueMessage(issue),
    ...(issue.path.length > 0 ? { path: issue.path.join(".") } : {}),
  }));

const parseEnvelope = (text: string): ValidationResult<EnvelopeHeader> => {
  if (byteLength(text) > MAX_BACKUP_BYTES) {
    return { ok: false, errors: [{ code: "file_too_large", message: `Backup exceeds the ${MAX_BACKUP_BYTES}-byte limit` }] };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ code: "malformed_json", message: "Backup is not valid JSON" }] };
  }

  if (
    typeof parsed === "object"
    && parsed !== null
    && "format" in parsed
    && parsed.format === BACKUP_FORMAT
    && "version" in parsed
    && parsed.version !== CURRENT_BACKUP_VERSION
  ) {
    return { ok: false, errors: [{ code: "unsupported_version", message: "Backup format version is not supported", path: "version" }] };
  }

  const result = envelopeHeaderSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, errors: zodErrors(result.error, "invalid_envelope") };
  }
  if (result.data.payments.length > MAX_BACKUP_RECORDS) {
    return { ok: false, errors: [{ code: "too_many_records", message: `Backup exceeds the ${MAX_BACKUP_RECORDS}-record limit`, path: "payments" }] };
  }
  return { ok: true, value: result.data };
};

const validateRecords = (records: readonly unknown[]): { valid: IndexedPayment[]; invalid: InvalidImportRecord[] } => {
  const parsed: IndexedPayment[] = [];
  const invalid: InvalidImportRecord[] = [];

  records.forEach((record, index) => {
    const result = validateBackupPayment(record);
    if (result.ok) {
      parsed.push({ index, value: result.value });
      return;
    }
    invalid.push({
      index,
      errors: result.errors.map((error) => ({ ...error, recordIndex: index })),
    });
  });

  const idCounts = new Map<string, number>();
  parsed.forEach(({ value }) => idCounts.set(value.id, (idCounts.get(value.id) ?? 0) + 1));

  const valid: IndexedPayment[] = [];
  parsed.forEach((record) => {
    if (idCounts.get(record.value.id) === 1) {
      valid.push(record);
      return;
    }
    invalid.push({
      index: record.index,
      errors: [{
        code: "duplicate_id",
        message: "Payment ID appears more than once in the backup",
        path: "id",
        recordIndex: record.index,
      }],
    });
  });

  invalid.sort((left, right) => left.index - right.index);
  return { valid, invalid };
};

export const validateBackupPayment = (value: unknown): ValidationResult<BackupPayment> => {
  const result = backupPaymentSchema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data as BackupPayment }
    : { ok: false, errors: zodErrors(result.error, "invalid_record") };
};

export const validateBackup = (text: string): ValidationResult<BackupEnvelope> => {
  const envelope = parseEnvelope(text);
  if (!envelope.ok) return envelope;

  const records = validateRecords(envelope.value.payments);
  if (records.invalid.length > 0) {
    return { ok: false, errors: records.invalid.flatMap(({ errors }) => errors) };
  }
  return {
    ok: true,
    value: {
      format: envelope.value.format,
      version: envelope.value.version,
      exportedAt: envelope.value.exportedAt,
      payments: records.valid.map(({ value }) => value),
    },
  };
};

const serializeValidatedBackup = (backup: BackupEnvelope): string => {
  const payments = [...backup.payments].sort((left, right) => {
    if (left.id < right.id) return -1;
    if (left.id > right.id) return 1;
    return 0;
  });
  return `${JSON.stringify({ ...backup, payments }, null, 2)}\n`;
};

export const createBackup = (payments: readonly BackupPayment[], exportedAt: Date = new Date()): BackupEnvelope => {
  if (payments.length > MAX_BACKUP_RECORDS) {
    throw new RangeError(`Cannot export more than ${MAX_BACKUP_RECORDS} payments`);
  }
  const candidate: BackupEnvelope = {
    format: BACKUP_FORMAT,
    version: CURRENT_BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    payments: [...payments],
  };
  const result = validateBackup(JSON.stringify(candidate));
  if (!result.ok) {
    const message = result.errors[0]?.message ?? "validation failed";
    if (result.errors[0]?.code === "file_too_large") throw new RangeError(`Cannot export backup: ${message}`);
    throw new TypeError(`Cannot export invalid backup: ${message}`);
  }
  if (byteLength(serializeValidatedBackup(result.value)) > MAX_BACKUP_BYTES) {
    throw new RangeError(`Cannot export backup: serialized output exceeds the ${MAX_BACKUP_BYTES}-byte limit`);
  }
  return result.value;
};

export const serializeBackup = (backup: BackupEnvelope): string => {
  const validated = validateBackup(JSON.stringify(backup));
  if (!validated.ok) {
    throw new TypeError(`Cannot serialize invalid backup: ${validated.errors[0]?.message ?? "validation failed"}`);
  }
  const serialized = serializeValidatedBackup(validated.value);
  if (byteLength(serialized) > MAX_BACKUP_BYTES) {
    throw new RangeError(`Serialized backup exceeds the ${MAX_BACKUP_BYTES}-byte limit`);
  }
  return serialized;
};

export const previewImport = (text: string, existingIds: ReadonlySet<string>): ValidationResult<ImportPreview> => {
  const envelope = parseEnvelope(text);
  if (!envelope.ok) return envelope;

  const records = validateRecords(envelope.value.payments);
  const validRecords = records.valid.map(({ value }) => value);
  return {
    ok: true,
    value: {
      envelope: {
        format: envelope.value.format,
        version: envelope.value.version,
        exportedAt: envelope.value.exportedAt,
      },
      validRecords,
      invalidRecords: records.invalid,
      newRecords: validRecords.filter((record) => !existingIds.has(record.id)),
      conflicts: validRecords.filter((record) => existingIds.has(record.id)),
    },
  };
};

export const createMergePlan = (preview: ImportPreview): MergeImportPlan =>
  preview.invalidRecords.length > 0
    ? { mode: "merge", ready: false, invalidRecords: [...preview.invalidRecords] }
    : { mode: "merge", ready: true, inserts: [...preview.newRecords], conflicts: [...preview.conflicts] };

export const createReplacementPlan = (preview: ImportPreview): ReplacementImportPlan =>
  preview.invalidRecords.length > 0
    ? { mode: "replace", ready: false, invalidRecords: [...preview.invalidRecords] }
    : { mode: "replace", ready: true, records: [...preview.validRecords] };
