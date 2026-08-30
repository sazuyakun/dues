import { DuesDatabase, SETTINGS_KEY, type SettingsRow } from "./database.js";
import { StorageError, toStorageError } from "./errors.js";
import type {
  AppSettings,
  AppSettingsPatch,
  BulkMutation,
  PaymentId,
  PaymentInput,
  PaymentRecord,
  PaymentRepository,
  SettingsRepository,
  StorageRepositories,
  UpdatePaymentOptions,
} from "./types.js";

const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  defaultCurrency: "USD",
  theme: "system",
};

export interface StorageOptions {
  readonly databaseName?: string;
  readonly now?: () => Date;
}

function timestamp(now: () => Date): string {
  return now().toISOString();
}

function nextTimestamp(now: () => Date, previous: string): string {
  const candidate = now().getTime();
  const previousTime = Date.parse(previous);
  return new Date(Math.max(candidate, previousTime + 1)).toISOString();
}

function assertPayment(payment: PaymentInput | PaymentRecord): void {
  if (!payment.id || !payment.name.trim()) throw new StorageError("invalid-data");
  if (!Number.isSafeInteger(payment.amount) || payment.amount < 0) {
    throw new StorageError("invalid-data");
  }
}

function assertExpected(record: PaymentRecord, expected?: string): void {
  if (expected !== undefined && record.updatedAt !== expected) {
    throw new StorageError("conflict");
  }
}

class DexiePaymentRepository implements PaymentRepository {
  constructor(
    private readonly database: DuesDatabase,
    private readonly now: () => Date,
  ) {}

  async create(payment: PaymentInput): Promise<PaymentRecord> {
    assertPayment(payment);
    const instant = timestamp(this.now);
    const record: PaymentRecord = { ...payment, createdAt: instant, updatedAt: instant };
    try {
      await this.database.payments.add(record);
      return record;
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async get(id: PaymentId): Promise<PaymentRecord | undefined> {
    try {
      return await this.database.payments.get(id);
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async list(): Promise<readonly PaymentRecord[]> {
    try {
      return await this.database.payments.orderBy("nextDueDate").toArray();
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async update(
    id: PaymentId,
    changes: Partial<Omit<PaymentInput, "id">>,
    options: UpdatePaymentOptions = {},
  ): Promise<PaymentRecord> {
    try {
      return await this.database.transaction("rw", this.database.payments, async () => {
        const current = await this.requirePayment(id);
        assertExpected(current, options.expectedUpdatedAt);
        const updated: PaymentRecord = {
          ...current,
          ...changes,
          id,
          createdAt: current.createdAt,
          updatedAt: nextTimestamp(this.now, current.updatedAt),
        };
        assertPayment(updated);
        await this.database.payments.put(updated);
        return updated;
      });
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  archive(id: PaymentId, options?: UpdatePaymentOptions): Promise<PaymentRecord> {
    return this.update(id, { status: "archived" }, options);
  }

  restore(id: PaymentId, options?: UpdatePaymentOptions): Promise<PaymentRecord> {
    return this.update(id, { status: "active" }, options);
  }

  async delete(id: PaymentId, options: UpdatePaymentOptions = {}): Promise<void> {
    try {
      await this.database.transaction("rw", this.database.payments, async () => {
        const current = await this.requirePayment(id);
        assertExpected(current, options.expectedUpdatedAt);
        await this.database.payments.delete(id);
      });
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async applyBulk(mutations: readonly BulkMutation[]): Promise<void> {
    try {
      await this.database.transaction("rw", this.database.payments, async () => {
        await this.validateBulk(mutations);
        for (const mutation of mutations) await this.applyMutation(mutation);
      });
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  private async requirePayment(id: PaymentId): Promise<PaymentRecord> {
    const record = await this.database.payments.get(id);
    if (!record) throw new StorageError("not-found");
    return record;
  }

  private async validateBulk(mutations: readonly BulkMutation[]): Promise<void> {
    const ids = new Set<string>();
    for (const mutation of mutations) {
      const id = mutation.type === "delete" ? mutation.id : mutation.payment.id;
      if (ids.has(id)) throw new StorageError("duplicate");
      ids.add(id);
      const existing = await this.database.payments.get(id);
      if (mutation.type === "create") {
        assertPayment(mutation.payment);
        if (existing) throw new StorageError("duplicate");
      } else {
        if (!existing) throw new StorageError("not-found");
        assertExpected(existing, mutation.expectedUpdatedAt);
        if (mutation.type === "update") assertPayment(mutation.payment);
      }
    }
  }

  private async applyMutation(mutation: BulkMutation): Promise<void> {
    if (mutation.type === "delete") await this.database.payments.delete(mutation.id);
    else if (mutation.type === "create") await this.database.payments.add(mutation.payment);
    else await this.database.payments.put(mutation.payment);
  }
}

class DexieSettingsRepository implements SettingsRepository {
  constructor(private readonly database: DuesDatabase) {}

  async get(): Promise<AppSettings> {
    try {
      const row = await this.database.settings.get(SETTINGS_KEY);
      if (!row) return DEFAULT_SETTINGS;
      const { key: _key, ...settings } = row;
      return settings;
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async update(changes: AppSettingsPatch): Promise<AppSettings> {
    try {
      return await this.database.transaction("rw", this.database.settings, async () => {
        const current = await this.get();
        const settings = { ...current, ...changes };
        const row: SettingsRow = { key: SETTINGS_KEY, ...settings };
        await this.database.settings.put(row);
        return settings;
      });
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }
}

export async function createStorage(options: StorageOptions = {}): Promise<StorageRepositories> {
  if (typeof indexedDB === "undefined") throw new StorageError("unavailable");
  const database = new DuesDatabase(options.databaseName ?? "dues");
  try {
    await database.open();
  } catch (error) {
    database.close();
    throw toStorageError(error, "initialization");
  }
  return {
    payments: new DexiePaymentRepository(database, options.now ?? (() => new Date())),
    settings: new DexieSettingsRepository(database),
    close: () => database.close(),
    deleteDatabase: async () => {
      database.close();
      await database.delete();
    },
  };
}
