import { describe, expect, it } from "vitest";
import {
  BACKUP_FORMAT,
  CURRENT_BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  MAX_BACKUP_RECORDS,
  createBackup,
  createMergePlan,
  createReplacementPlan,
  previewImport,
  serializeBackup,
  validateBackup,
  validateBackupPayment,
  type BackupPayment,
} from "../src";

const payment = (overrides: Partial<BackupPayment> = {}): BackupPayment => ({
  id: "payment-1",
  name: "Video service",
  amount: 1299,
  currency: "USD",
  recurrence: { type: "monthly" },
  nextDueDate: "2026-09-30",
  status: "active",
  ...overrides,
});

const json = (payments: unknown[], overrides: Record<string, unknown> = {}): string => JSON.stringify({
  format: BACKUP_FORMAT,
  version: CURRENT_BACKUP_VERSION,
  exportedAt: "2026-08-30T10:00:00.000Z",
  payments,
  ...overrides,
});

describe("backup export", () => {
  it("creates a valid current-version backup", () => {
    const backup = createBackup([payment()], new Date("2026-08-30T10:00:00.000Z"));
    expect(validateBackup(serializeBackup(backup))).toEqual({ ok: true, value: backup });
  });

  it("serializes deterministically with records ordered by ID", () => {
    const at = new Date("2026-08-30T10:00:00.000Z");
    const first = serializeBackup(createBackup([payment({ id: "a" }), payment({ id: "Z" })], at));
    const second = serializeBackup(createBackup([payment({ id: "Z" }), payment({ id: "a" })], at));
    expect(first).toBe(second);
    expect(first.indexOf('"id": "Z"')).toBeLessThan(first.indexOf('"id": "a"'));
    expect(first.endsWith("\n")).toBe(true);
  });

  it("does not create a backup whose formatted output exceeds the byte limit", () => {
    const payments = Array.from({ length: MAX_BACKUP_RECORDS }, (_, index) => payment({
      id: `payment-${index}`,
      notes: "x".repeat(300),
    }));
    expect(() => createBackup(payments, new Date("2026-08-30T10:00:00.000Z"))).toThrow(RangeError);
  });
});

describe("strict validation", () => {
  it("rejects malformed JSON", () => expect(validateBackup("{")).toMatchObject({ ok: false, errors: [{ code: "malformed_json" }] }));
  it("rejects unsupported versions", () => expect(validateBackup(json([], { version: 2 }))).toMatchObject({ ok: false, errors: [{ code: "unsupported_version" }] }));
  it("does not treat another format as a Dues version", () => {
    const result = validateBackup(json([], { format: "other-backup", version: 2 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.every(({ code }) => code === "invalid_envelope")).toBe(true);
  });
  it("rejects missing fields and unexpected properties", () => {
    expect(validateBackup(json([{ ...payment(), amount: undefined }]))).toMatchObject({ ok: false, errors: [{ code: "invalid_record" }] });
    expect(validateBackup(json([{ ...payment(), surprise: true }]))).toMatchObject({ ok: false, errors: [{ code: "invalid_record" }] });
    expect(validateBackup(json([], { surprise: true }))).toMatchObject({ ok: false, errors: [{ code: "invalid_envelope" }] });
  });

  it.each(["2025-02-29", "2026-04-31", "30-01-01"])("rejects impossible or invalid date %s", (date) => {
    expect(validateBackupPayment(payment({ nextDueDate: date as BackupPayment["nextDueDate"] })).ok).toBe(false);
  });

  it.each(["0001-01-01", "0004-02-29", "2000-02-29"])("accepts real calendar date %s", (nextDueDate) => {
    expect(validateBackupPayment(payment({ nextDueDate: nextDueDate as BackupPayment["nextDueDate"] })).ok).toBe(true);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid amount %s", (amount) => {
    expect(validateBackupPayment(payment({ amount })).ok).toBe(false);
  });

  it("accepts current and historical ISO 4217 codes and rejects unknown codes", () => {
    expect(validateBackupPayment(payment({ currency: "ZWG" })).ok).toBe(true);
    expect(validateBackupPayment(payment({ currency: "BGN" })).ok).toBe(true);
    expect(validateBackupPayment(payment({ currency: "ZZZ" })).ok).toBe(false);
  });

  it("enforces byte and record limits", () => {
    expect(validateBackup(" ".repeat(MAX_BACKUP_BYTES + 1))).toMatchObject({ ok: false, errors: [{ code: "file_too_large" }] });
    expect(validateBackup(json(new Array(MAX_BACKUP_RECORDS + 1).fill(null)))).toMatchObject({ ok: false, errors: [{ code: "too_many_records" }] });
  });

  it("rejects duplicate IDs", () => {
    const result = validateBackup(json([payment(), payment()]));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toMatchObject([
      { code: "duplicate_id", recordIndex: 0 },
      { code: "duplicate_id", recordIndex: 1 },
    ]);
  });

  it("accepts script-like text as inert data", () => {
    const record = payment({ name: "<script>alert(1)</script>", category: "<img onerror=x>", notes: "javascript:alert(1)" });
    expect(validateBackupPayment(record)).toEqual({ ok: true, value: record });
  });

  it("returns errors that do not echo imported keys or values", () => {
    const malicious = "<img src=x onerror=alert(1)>";
    const result = validateBackupPayment({ ...payment(), status: malicious, [malicious]: true });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(JSON.stringify(result.errors)).not.toContain(malicious);
  });

  it("rejects IDs with surrounding whitespace instead of transforming them", () => {
    expect(validateBackupPayment(payment({ id: " payment-1 " })).ok).toBe(false);
  });

  it.each(["not a URL", " https://example.com", "javascript:alert(1)", "data:text/html,bad", "http://example.com/manage", "https://user:secret@example.com"])("rejects unsafe provider URL %s", (providerUrl) => {
    expect(() => validateBackupPayment(payment({ providerUrl }))).not.toThrow();
    expect(validateBackupPayment(payment({ providerUrl })).ok).toBe(false);
  });

  it.each(["https://example.com/manage", "http://localhost:5173/manage", "http://127.0.0.1/manage"])("accepts safe provider URL %s", (providerUrl) => {
    expect(validateBackupPayment(payment({ providerUrl })).ok).toBe(true);
  });
});

describe("import preview and plans", () => {
  it("separates valid, invalid, new, and conflicting records", () => {
    const result = previewImport(json([
      payment({ id: "new" }),
      payment({ id: "existing" }),
      { ...payment({ id: "bad" }), amount: -1 },
    ]), new Set(["existing"]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.validRecords.map(({ id }) => id)).toEqual(["new", "existing"]);
    expect(result.value.invalidRecords).toHaveLength(1);
    expect(result.value.newRecords.map(({ id }) => id)).toEqual(["new"]);
    expect(result.value.conflicts.map(({ id }) => id)).toEqual(["existing"]);
    const mergePlan = createMergePlan(result.value);
    const replacementPlan = createReplacementPlan(result.value);
    expect(mergePlan).toMatchObject({ mode: "merge", ready: false, invalidRecords: [{ index: 2 }] });
    expect(replacementPlan).toMatchObject({ mode: "replace", ready: false, invalidRecords: [{ index: 2 }] });
    expect("inserts" in mergePlan).toBe(false);
    expect("records" in replacementPlan).toBe(false);
  });

  it("marks every occurrence of a duplicate ID invalid", () => {
    const result = previewImport(json([payment(), payment()]), new Set());
    expect(result).toMatchObject({
      ok: true,
      value: {
        validRecords: [],
        invalidRecords: [
          { index: 0, errors: [{ code: "duplicate_id" }] },
          { index: 1, errors: [{ code: "duplicate_id" }] },
        ],
      },
    });
  });

  it("creates ready plans only from a fully valid preview", () => {
    const result = previewImport(json([payment({ id: "new" }), payment({ id: "existing" })]), new Set(["existing"]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(createMergePlan(result.value)).toMatchObject({
      mode: "merge",
      ready: true,
      inserts: [{ id: "new" }],
      conflicts: [{ id: "existing" }],
    });
    expect(createReplacementPlan(result.value)).toMatchObject({
      mode: "replace",
      ready: true,
      records: [{ id: "new" }, { id: "existing" }],
    });
  });
});
