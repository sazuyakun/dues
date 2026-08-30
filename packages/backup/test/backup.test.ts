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
    const first = serializeBackup(createBackup([payment({ id: "z" }), payment({ id: "a" })], at));
    const second = serializeBackup(createBackup([payment({ id: "a" }), payment({ id: "z" })], at));
    expect(first).toBe(second);
    expect(first.endsWith("\n")).toBe(true);
  });
});

describe("strict validation", () => {
  it("rejects malformed JSON", () => expect(validateBackup("{")).toMatchObject({ ok: false, errors: [{ code: "malformed_json" }] }));
  it("rejects unsupported versions", () => expect(validateBackup(json([], { version: 2 }))).toMatchObject({ ok: false, errors: [{ code: "unsupported_version" }] }));
  it("rejects missing fields and unexpected properties", () => {
    expect(validateBackup(json([{ ...payment(), amount: undefined }]))).toMatchObject({ ok: false, errors: [{ code: "invalid_record" }] });
    expect(validateBackup(json([{ ...payment(), surprise: true }]))).toMatchObject({ ok: false, errors: [{ code: "invalid_record" }] });
    expect(validateBackup(json([], { surprise: true }))).toMatchObject({ ok: false, errors: [{ code: "invalid_envelope" }] });
  });

  it.each(["2025-02-29", "2026-04-31", "30-01-01"])("rejects impossible or invalid date %s", (date) => {
    expect(validateBackupPayment(payment({ nextDueDate: date as BackupPayment["nextDueDate"] })).ok).toBe(false);
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid amount %s", (amount) => {
    expect(validateBackupPayment(payment({ amount })).ok).toBe(false);
  });

  it("enforces byte and record limits", () => {
    expect(validateBackup(" ".repeat(MAX_BACKUP_BYTES + 1))).toMatchObject({ ok: false, errors: [{ code: "file_too_large" }] });
    expect(validateBackup(json(new Array(MAX_BACKUP_RECORDS + 1).fill(null)))).toMatchObject({ ok: false, errors: [{ code: "too_many_records" }] });
  });

  it("rejects duplicate IDs", () => {
    expect(validateBackup(json([payment(), payment()]))).toMatchObject({ ok: false, errors: [{ code: "duplicate_id", recordIndex: 1 }] });
  });

  it("accepts script-like text as inert data", () => {
    const record = payment({ name: "<script>alert(1)</script>", category: "<img onerror=x>", notes: "javascript:alert(1)" });
    expect(validateBackupPayment(record)).toEqual({ ok: true, value: record });
  });

  it.each(["javascript:alert(1)", "data:text/html,bad", "http://example.com/manage"])("rejects unsafe provider URL %s", (providerUrl) => {
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
    expect(createMergePlan(result.value)).toMatchObject({ mode: "merge", inserts: [{ id: "new" }], conflicts: [{ id: "existing" }] });
    expect(createReplacementPlan(result.value)).toMatchObject({ mode: "replace", records: [{ id: "new" }, { id: "existing" }] });
  });

  it("marks later duplicate IDs invalid", () => {
    const result = previewImport(json([payment(), payment()]), new Set());
    expect(result).toMatchObject({ ok: true, value: { validRecords: [{ id: "payment-1" }], invalidRecords: [{ index: 1, errors: [{ code: "duplicate_id" }] }] } });
  });
});
