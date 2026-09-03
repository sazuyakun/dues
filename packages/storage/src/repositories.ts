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
import {
  validatePaymentInput,
  validatePaymentRecord,
  validateSettings,
} from "./validation.js";

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
  try {
    return now().toISOString();
  } catch (error) {
    throw new StorageError("invalid-data", { cause: error });
  }
}

function nextTimestamp(now: () => Date, previous: string): string {
  const candidate = now().getTime();
  const previousTime = Date.parse(previous);
  if (!Number.isFinite(candidate) || !Number.isFinite(previousTime)) {
    throw new StorageError("invalid-data");
  }
  return new Date(Math.max(candidate, previousTime + 1)).toISOString();
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
    try {
      const instant = timestamp(this.now);
      const record = validatePaymentRecord({
        ...validatePaymentInput(payment),
        createdAt: instant,
        updatedAt: instant,
      });
      await this.database.payments.add(record);
      return record;
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async get(id: PaymentId): Promise<PaymentRecord | undefined> {
    try {
      const record = await this.database.payments.get(id);
      return record === undefined ? undefined : validatePaymentRecord(record);
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async list(): Promise<readonly PaymentRecord[]> {
    try {
      const records = await this.database.payments
        .orderBy("nextDueDate")
        .toArray();
      return records.map(validatePaymentRecord);
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
      return await this.database.transaction(
        "rw",
        this.database.payments,
        async () => {
          const current = await this.requirePayment(id);
          assertExpected(current, options.expectedUpdatedAt);
          const updated = validatePaymentRecord({
            ...current,
            ...changes,
            id,
            createdAt: current.createdAt,
            updatedAt: nextTimestamp(this.now, current.updatedAt),
          });
          await this.database.payments.put(updated);
          return updated;
        },
      );
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  archive(
    id: PaymentId,
    options?: UpdatePaymentOptions,
  ): Promise<PaymentRecord> {
    return this.update(id, { status: "archived" }, options);
  }

  restore(
    id: PaymentId,
    options?: UpdatePaymentOptions,
  ): Promise<PaymentRecord> {
    return this.update(id, { status: "active" }, options);
  }

  async delete(
    id: PaymentId,
    options: UpdatePaymentOptions = {},
  ): Promise<void> {
    try {
      await this.database.transaction(
        "rw",
        this.database.payments,
        async () => {
          const current = await this.requirePayment(id);
          assertExpected(current, options.expectedUpdatedAt);
          await this.database.payments.delete(id);
        },
      );
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async applyBulk(mutations: readonly BulkMutation[]): Promise<void> {
    try {
      await this.database.transaction(
        "rw",
        this.database.payments,
        async () => {
          const validatedMutations = mutations.map((mutation) =>
            mutation.type === "delete"
              ? mutation
              : {
                  ...mutation,
                  payment: validatePaymentRecord(mutation.payment),
                },
          );
          await this.validateBulk(validatedMutations);
          for (const mutation of validatedMutations) {
            await this.applyMutation(mutation);
          }
        },
      );
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  private async requirePayment(id: PaymentId): Promise<PaymentRecord> {
    const record = await this.database.payments.get(id);
    if (!record) throw new StorageError("not-found");
    return validatePaymentRecord(record);
  }

  private async validateBulk(
    mutations: readonly BulkMutation[],
  ): Promise<void> {
    const ids = new Set<string>();
    for (const mutation of mutations) {
      const id = mutation.type === "delete" ? mutation.id : mutation.payment.id;
      if (ids.has(id)) throw new StorageError("duplicate");
      ids.add(id);
      const existing = await this.database.payments.get(id);
      if (mutation.type === "create") {
        if (existing) throw new StorageError("duplicate");
      } else {
        if (!existing) throw new StorageError("not-found");
        const current = validatePaymentRecord(existing);
        assertExpected(current, mutation.expectedUpdatedAt);
        if (
          mutation.type === "update" &&
          Date.parse(mutation.payment.updatedAt) <=
            Date.parse(current.updatedAt)
        ) {
          throw new StorageError("invalid-data");
        }
      }
    }
  }

  private async applyMutation(mutation: BulkMutation): Promise<void> {
    if (mutation.type === "delete")
      await this.database.payments.delete(mutation.id);
    else if (mutation.type === "create")
      await this.database.payments.add(mutation.payment);
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
      return validateSettings(settings);
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }

  async update(changes: AppSettingsPatch): Promise<AppSettings> {
    try {
      return await this.database.transaction(
        "rw",
        this.database.settings,
        async () => {
          const current = await this.get();
          const settings = validateSettings({ ...current, ...changes });
          const row: SettingsRow = { key: SETTINGS_KEY, ...settings };
          await this.database.settings.put(row);
          return settings;
        },
      );
    } catch (error) {
      throw toStorageError(error, "transaction");
    }
  }
}

export async function createStorage(
  options: StorageOptions = {},
): Promise<StorageRepositories> {
  if (typeof indexedDB === "undefined") throw new StorageError("unavailable");
  const database = new DuesDatabase(options.databaseName ?? "dues");
  try {
    await database.open();
  } catch (error) {
    database.close();
    throw toStorageError(error, "initialization");
  }
  return {
    payments: new DexiePaymentRepository(
      database,
      options.now ?? (() => new Date()),
    ),
    settings: new DexieSettingsRepository(database),
    close: () => database.close(),
  };
}
