import Dexie, { type EntityTable } from "dexie";

import type { AppSettings, PaymentRecord } from "./types.js";
import { validatePaymentRecord } from "./validation.js";

export const CURRENT_DATABASE_VERSION = 2;
export const SETTINGS_KEY = "app";

export interface SettingsRow extends AppSettings {
  readonly key: typeof SETTINGS_KEY;
}

export class DuesDatabase extends Dexie {
  payments!: EntityTable<PaymentRecord, "id">;
  settings!: EntityTable<SettingsRow, "key">;

  constructor(name: string) {
    super(name);

    // Every future schema change adds another version().stores().upgrade()
    // declaration. Existing versions must remain intact for in-place upgrades.
    this.version(1).stores({
      payments: "&id, status, nextDueDate, currency, updatedAt",
      settings: "&key",
    });

    this.version(CURRENT_DATABASE_VERSION)
      .stores({
        payments: "&id, status, nextDueDate, currency, updatedAt",
        settings: "&key",
      })
      .upgrade(async (transaction) => {
        const payments = transaction.table<PaymentRecord, string>("payments");
        const records = await payments.toArray();
        await payments.bulkPut(records.map(validatePaymentRecord));
      });
  }
}
