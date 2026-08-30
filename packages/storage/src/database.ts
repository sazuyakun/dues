import Dexie, { type EntityTable } from "dexie";

import type { AppSettings, PaymentRecord } from "./types.js";

export const CURRENT_DATABASE_VERSION = 1;
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
    this.version(CURRENT_DATABASE_VERSION).stores({
      payments: "&id, status, nextDueDate, currency, updatedAt",
      settings: "&key",
    });
  }
}
