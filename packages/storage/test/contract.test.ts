import "fake-indexeddb/auto";

import {
  createBackup,
  createMergePlan,
  fromBackupPayment,
  previewImport,
  serializeBackup,
  validateBackup,
} from "../../backup/src/index.js";
import {
  advanceCalendarDate,
  validateRecurringPayment,
} from "../../core/src/index.js";
import { describe, expect, it } from "vitest";

import { createStorage, type PaymentRecord } from "../src/index.js";

let sequence = 0;

async function deleteDatabase(name: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("cross-package persistence contract", () => {
  it("validates, persists, exports, previews, imports, and reloads a complete record", async () => {
    const sourceName = `dues-contract-source-${sequence++}`;
    const targetName = `dues-contract-target-${sequence++}`;
    const canonical = validateRecurringPayment({
      id: "complete-canonical-record",
      name: "Infrastructure membership",
      amount: 12_345,
      currency: "INR",
      recurrence: {
        frequency: "custom",
        interval: {
          count: 2,
          unit: "year",
          anchorMonth: 2,
          anchorDay: 29,
        },
      },
      nextDueDate: "2028-02-29",
      status: "active",
      category: "Infrastructure",
      paymentMethodLabel: "UPI mandate",
      freeTrialEndDate: "2026-09-15",
      notes: "Renew only while the project remains active.",
      providerUrl: "https://example.com/manage",
      reminderLeadDays: 14,
    });

    let source = await createStorage({ databaseName: sourceName });
    let target = await createStorage({ databaseName: targetName });
    try {
      await source.payments.create(canonical);
      source.close();
      source = await createStorage({ databaseName: sourceName });
      const persisted = await source.payments.list();

      const text = serializeBackup(
        createBackup(persisted, new Date("2026-09-03T10:00:00.000Z")),
      );
      expect(validateBackup(text).ok).toBe(true);
      const preview = previewImport(text, new Set());
      expect(preview.ok).toBe(true);
      if (!preview.ok) return;

      const plan = createMergePlan(preview.value);
      expect(plan.ready).toBe(true);
      if (!plan.ready) return;
      const importedAt = "2026-09-03T10:00:00.001Z";
      const records: PaymentRecord[] = plan.inserts.map((payment) => ({
        ...validateRecurringPayment(fromBackupPayment(payment)),
        createdAt: importedAt,
        updatedAt: importedAt,
      }));
      await target.payments.applyBulk(
        records.map((payment) => ({ type: "create", payment })),
      );
      target.close();
      target = await createStorage({ databaseName: targetName });

      const restored = await target.payments.get(canonical.id);
      expect(restored).toBeDefined();
      if (restored === undefined) return;
      const {
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...payment
      } = restored;
      expect(payment).toEqual(canonical);
      expect(
        advanceCalendarDate(restored.nextDueDate, restored.recurrence),
      ).toBe("2030-02-28");
    } finally {
      source.close();
      target.close();
      await deleteDatabase(sourceName);
      await deleteDatabase(targetName);
    }
  });
});
