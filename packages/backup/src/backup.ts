import { ZodError } from "zod";
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

const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

const safeId = (value: unknown): string | undefined => {
  if (typeof value !== "object" || value === null || !("id" in value)) return undefined;
  return typeof value.id === "string" ? value.id.slice(0, 200) : undefined;
};

const zodErrors = (error: ZodError, base: Omit<ValidationError, "message" | "path">): ValidationError[] =>
  error.issues.map((issue) => ({
    ...base,
    message: issue.message,
    ...(issue.path.length > 0 ? { path: issue.path.join(".") } : {}),
  }));

export const validateBackupPayment = (value: unknown): ValidationResult<BackupPayment> => {
  const result = backupPaymentSchema.safeParse(value);
  return result.success
    ? { ok: true, value: result.data as BackupPayment }
    : { ok: false, errors: zodErrors(result.error, { code: "invalid_record" }) };
};

export const validateBackup = (text: string): ValidationResult<BackupEnvelope> => {
  if (byteLength(text) > MAX_BACKUP_BYTES) {
    return { ok: false, errors: [{ code: "file_too_large", message: `Backup exceeds the ${MAX_BACKUP_BYTES}-byte limit` }] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ code: "malformed_json", message: "Backup is not valid JSON" }] };
  }
  if (typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version !== CURRENT_BACKUP_VERSION) {
    return { ok: false, errors: [{ code: "unsupported_version", message: "Backup format version is not supported", path: "version" }] };
  }
  const header = envelopeHeaderSchema.safeParse(parsed);
  if (!header.success) {
    return { ok: false, errors: zodErrors(header.error, { code: "invalid_envelope" }) };
  }
  if (header.data.payments.length > MAX_BACKUP_RECORDS) {
    return { ok: false, errors: [{ code: "too_many_records", message: `Backup exceeds the ${MAX_BACKUP_RECORDS}-record limit`, path: "payments" }] };
  }
  const payments: BackupPayment[] = [];
  const errors: ValidationError[] = [];
  const seen = new Set<string>();
  header.data.payments.forEach((record, index) => {
    const result = validateBackupPayment(record);
    const id = safeId(record);
    if (!result.ok) {
      errors.push(...result.errors.map((error) => ({ ...error, recordIndex: index, ...(id === undefined ? {} : { recordId: id }) })));
      return;
    }
    if (seen.has(result.value.id)) {
      errors.push({ code: "duplicate_id", message: "Payment ID appears more than once in the backup", path: "id", recordIndex: index, recordId: result.value.id });
      return;
    }
    seen.add(result.value.id);
    payments.push(result.value);
  });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { ...header.data, payments } as BackupEnvelope };
};

export const createBackup = (payments: readonly BackupPayment[], exportedAt: Date = new Date()): BackupEnvelope => {
  const validated = payments.map((payment) => {
    const result = validateBackupPayment(payment);
    if (!result.ok) throw new TypeError(`Cannot export invalid payment: ${result.errors[0]?.message ?? "validation failed"}`);
    return result.value;
  });
  if (validated.length > MAX_BACKUP_RECORDS) throw new RangeError(`Cannot export more than ${MAX_BACKUP_RECORDS} payments`);
  return { format: BACKUP_FORMAT, version: CURRENT_BACKUP_VERSION, exportedAt: exportedAt.toISOString(), payments: validated };
};

export const serializeBackup = (backup: BackupEnvelope): string => {
  const validated = validateBackup(JSON.stringify(backup));
  if (!validated.ok) throw new TypeError(`Cannot serialize invalid backup: ${validated.errors[0]?.message ?? "validation failed"}`);
  const sorted = [...validated.value.payments].sort((left, right) => left.id.localeCompare(right.id));
  return `${JSON.stringify({ ...validated.value, payments: sorted }, null, 2)}\n`;
};

export const previewImport = (text: string, existingIds: ReadonlySet<string>): ValidationResult<ImportPreview> => {
  if (byteLength(text) > MAX_BACKUP_BYTES) return { ok: false, errors: [{ code: "file_too_large", message: `Backup exceeds the ${MAX_BACKUP_BYTES}-byte limit` }] };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, errors: [{ code: "malformed_json", message: "Backup is not valid JSON" }] }; }
  if (typeof parsed === "object" && parsed !== null && "version" in parsed && parsed.version !== CURRENT_BACKUP_VERSION) {
    return { ok: false, errors: [{ code: "unsupported_version", message: "Backup format version is not supported", path: "version" }] };
  }
  const header = envelopeHeaderSchema.safeParse(parsed);
  if (!header.success) return { ok: false, errors: zodErrors(header.error, { code: "invalid_envelope" }) };
  if (header.data.payments.length > MAX_BACKUP_RECORDS) return { ok: false, errors: [{ code: "too_many_records", message: `Backup exceeds the ${MAX_BACKUP_RECORDS}-record limit`, path: "payments" }] };

  const validRecords: BackupPayment[] = [];
  const invalidRecords: InvalidImportRecord[] = [];
  const seen = new Set<string>();
  header.data.payments.forEach((record, index) => {
    const result = validateBackupPayment(record);
    const id = safeId(record);
    if (!result.ok) {
      invalidRecords.push({ index, ...(id === undefined ? {} : { id }), errors: result.errors.map((error) => ({ ...error, recordIndex: index, ...(id === undefined ? {} : { recordId: id }) })) });
    } else if (seen.has(result.value.id)) {
      invalidRecords.push({ index, id: result.value.id, errors: [{ code: "duplicate_id", message: "Payment ID appears more than once in the backup", path: "id", recordIndex: index, recordId: result.value.id }] });
    } else {
      seen.add(result.value.id);
      validRecords.push(result.value);
    }
  });
  return {
    ok: true,
    value: {
      envelope: { format: header.data.format, version: header.data.version, exportedAt: header.data.exportedAt },
      validRecords,
      invalidRecords,
      newRecords: validRecords.filter((record) => !existingIds.has(record.id)),
      conflicts: validRecords.filter((record) => existingIds.has(record.id)),
    },
  };
};

export const createMergePlan = (preview: ImportPreview): MergeImportPlan => ({
  mode: "merge",
  inserts: [...preview.newRecords],
  conflicts: [...preview.conflicts],
  invalidRecords: [...preview.invalidRecords],
});

export const createReplacementPlan = (preview: ImportPreview): ReplacementImportPlan => ({
  mode: "replace",
  records: [...preview.validRecords],
  invalidRecords: [...preview.invalidRecords],
});
