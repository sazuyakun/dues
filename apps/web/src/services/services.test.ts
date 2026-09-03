import {
  BACKUP_FORMAT,
  CURRENT_BACKUP_VERSION,
  type ImportPreview,
} from "@dues/backup";
import { validateRecurringPayment, type RecurringPayment } from "@dues/core";
import {
  StorageError,
  type AppSettings,
  type AppSettingsPatch,
  type BulkMutation,
  type PaymentId,
  type PaymentInput,
  type PaymentRecord,
  type PaymentRepository,
  type SettingsRepository,
  type StorageRepositories,
  type UpdatePaymentOptions,
} from "@dues/storage";
import { describe, expect, it, vi } from "vitest";
import { ApplicationError, createDeterministicEnvironment } from "../app/index";
import {
  createApplicationInitializer,
  createApplicationServices,
  createBackupService,
  createPaymentService,
  toServiceError,
} from "./index";

function record(
  id: string,
  overrides: Partial<RecurringPayment> = {},
): PaymentRecord {
  return {
    ...validateRecurringPayment({
      id,
      name: `Payment ${id}`,
      amount: 1_299,
      currency: "USD",
      recurrence: { frequency: "monthly", anchorDay: 31 },
      nextDueDate: "2026-01-31",
      status: "active",
      ...overrides,
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

class MemoryPaymentRepository implements PaymentRepository {
  private records: Map<string, PaymentRecord>;
  private updateSequence = 1;
  failNextBulkWith?: StorageError;

  constructor(initial: readonly PaymentRecord[] = []) {
    this.records = new Map(initial.map((payment) => [payment.id, payment]));
  }

  async create(payment: PaymentInput): Promise<PaymentRecord> {
    if (this.records.has(payment.id)) throw new StorageError("duplicate");
    const created = {
      ...payment,
      createdAt: "2026-09-03T10:00:00.000Z",
      updatedAt: "2026-09-03T10:00:00.000Z",
    };
    this.records.set(payment.id, created);
    return created;
  }

  async get(id: PaymentId): Promise<PaymentRecord | undefined> {
    return this.records.get(id);
  }

  async list(): Promise<readonly PaymentRecord[]> {
    return [...this.records.values()];
  }

  async update(
    id: PaymentId,
    changes: Partial<Omit<PaymentInput, "id">>,
    options: UpdatePaymentOptions = {},
  ): Promise<PaymentRecord> {
    const current = this.records.get(id);
    if (current === undefined) throw new StorageError("not-found");
    if (
      options.expectedUpdatedAt !== undefined &&
      options.expectedUpdatedAt !== current.updatedAt
    ) {
      throw new StorageError("conflict");
    }
    const updated = {
      ...current,
      ...changes,
      id,
      createdAt: current.createdAt,
      updatedAt: `2026-09-03T10:00:00.${String(this.updateSequence++).padStart(3, "0")}Z`,
    };
    this.records.set(id, updated);
    return updated;
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
    const current = this.records.get(id);
    if (current === undefined) throw new StorageError("not-found");
    if (
      options.expectedUpdatedAt !== undefined &&
      options.expectedUpdatedAt !== current.updatedAt
    ) {
      throw new StorageError("conflict");
    }
    this.records.delete(id);
  }

  async applyBulk(mutations: readonly BulkMutation[]): Promise<void> {
    if (this.failNextBulkWith !== undefined) {
      const error = this.failNextBulkWith;
      this.failNextBulkWith = undefined;
      throw error;
    }

    const next = new Map(this.records);
    const ids = new Set<string>();
    for (const mutation of mutations) {
      const id = mutation.type === "delete" ? mutation.id : mutation.payment.id;
      if (ids.has(id)) throw new StorageError("duplicate");
      ids.add(id);
      const current = next.get(id);
      if (mutation.type === "create") {
        if (current !== undefined) throw new StorageError("duplicate");
        next.set(id, mutation.payment);
      } else {
        if (current === undefined) throw new StorageError("not-found");
        if (
          mutation.expectedUpdatedAt !== undefined &&
          mutation.expectedUpdatedAt !== current.updatedAt
        ) {
          throw new StorageError("conflict");
        }
        if (mutation.type === "delete") next.delete(id);
        else next.set(id, mutation.payment);
      }
    }
    this.records = next;
  }
}

class MemorySettingsRepository implements SettingsRepository {
  private settings: AppSettings = {
    onboardingComplete: false,
    defaultCurrency: "USD",
    theme: "system",
  };

  async get(): Promise<AppSettings> {
    return this.settings;
  }

  async update(changes: AppSettingsPatch): Promise<AppSettings> {
    this.settings = { ...this.settings, ...changes };
    return this.settings;
  }
}

function repositories(
  payments: PaymentRepository,
  close = vi.fn(),
): StorageRepositories {
  return {
    payments,
    settings: new MemorySettingsRepository(),
    close,
  };
}

describe("production payment service", () => {
  it("generates IDs, validates input, and advances overdue payments", async () => {
    const repository = new MemoryPaymentRepository();
    const environment = createDeterministicEnvironment({
      ids: ["generated-id", "invalid-id"],
    });
    const service = createPaymentService(repository, environment);
    const created = await service.create({
      name: "Workspace suite",
      amount: 2_499,
      currency: "USD",
      recurrence: { frequency: "monthly", anchorDay: 31 },
      nextDueDate: "2026-01-31",
      status: "active",
    });

    expect(created.id).toBe("generated-id");
    const advanced = await service.markPaid(created.id, {
      expectedUpdatedAt: created.updatedAt,
      paidThrough: "2026-03-15",
    });
    expect(advanced.nextDueDate).toBe("2026-03-31");

    await expect(
      service.create({
        name: "",
        amount: 100,
        currency: "USD",
        recurrence: { frequency: "weekly" },
        nextDueDate: "2026-09-03",
        status: "active",
      }),
    ).rejects.toEqual(new ApplicationError("invalid-data"));
  });

  it("maps stale writes and rejects mark-paid for inactive records", async () => {
    const active = record("active");
    const paused = record("paused", { status: "paused" });
    const repository = new MemoryPaymentRepository([active, paused]);
    const service = createPaymentService(
      repository,
      createDeterministicEnvironment(),
    );
    await repository.update("active", { name: "Changed elsewhere" });

    await expect(
      service.update(
        "active",
        { name: "Stale edit" },
        {
          expectedUpdatedAt: active.updatedAt,
        },
      ),
    ).rejects.toEqual(new ApplicationError("conflict"));
    await expect(
      service.markPaid("paused", { expectedUpdatedAt: paused.updatedAt }),
    ).rejects.toEqual(new ApplicationError("invalid-data"));
    expect((await repository.get("paused"))?.nextDueDate).toBe("2026-01-31");
  });

  it("restores both paused and archived records to active", async () => {
    const paused = record("paused", { status: "paused" });
    const archived = record("archived", { status: "archived" });
    const active = record("active");
    const service = createPaymentService(
      new MemoryPaymentRepository([paused, archived, active]),
      createDeterministicEnvironment(),
    );

    await expect(
      service.restore("paused", { expectedUpdatedAt: paused.updatedAt }),
    ).resolves.toMatchObject({ status: "active" });
    await expect(
      service.restore("archived", { expectedUpdatedAt: archived.updatedAt }),
    ).resolves.toMatchObject({ status: "active" });
    await expect(
      service.restore("active", { expectedUpdatedAt: active.updatedAt }),
    ).rejects.toEqual(new ApplicationError("invalid-data"));
  });
});

describe("production backup service", () => {
  it("exports, previews, and merges without overwriting conflicts", async () => {
    const source = new MemoryPaymentRepository([
      record("existing", { name: "Portable version" }),
      record("new"),
    ]);
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
      instants: ["2026-09-03T10:00:00.000Z"],
    });
    const download = await createBackupService(source, environment).export();
    expect(download.filename).toBe("dues-backup-2026-09-03.json");
    expect(download.contents).not.toContain("createdAt");

    const target = new MemoryPaymentRepository([
      record("existing", { name: "Keep local version" }),
    ]);
    const service = createBackupService(target, environment);
    const preview = await service.preview(download.contents);
    expect(preview.conflicts.map(({ id }) => id)).toEqual(["existing"]);
    const result = await service.applyMerge(preview);

    expect(result).toEqual({ inserted: 1, updated: 0, removed: 0, total: 2 });
    expect((await target.get("existing"))?.name).toBe("Keep local version");
    expect((await target.get("new"))?.createdAt).toBe(
      "2026-09-03T10:00:00.001Z",
    );
  });

  it("replaces records atomically and reports a transaction failure safely", async () => {
    const target = new MemoryPaymentRepository([
      record("old"),
      record("shared"),
    ]);
    const service = createBackupService(
      target,
      createDeterministicEnvironment({
        instants: ["2026-09-03T10:00:00.000Z"],
      }),
    );
    const source = new MemoryPaymentRepository([
      record("shared", { name: "Imported shared" }),
      record("new"),
    ]);
    const text = (
      await createBackupService(
        source,
        createDeterministicEnvironment({
          instants: ["2026-09-03T09:00:00.000Z"],
        }),
      ).export()
    ).contents;
    const preview = await service.preview(text);
    target.failNextBulkWith = new StorageError("transaction");

    await expect(service.applyReplacement(preview)).rejects.toEqual(
      new ApplicationError("operation-failed"),
    );
    expect((await target.list()).map(({ id }) => id)).toEqual([
      "old",
      "shared",
    ]);

    const result = await service.applyReplacement(preview);
    expect(result).toEqual({ inserted: 1, updated: 1, removed: 1, total: 2 });
    expect((await target.list()).map(({ id }) => id)).toEqual([
      "shared",
      "new",
    ]);
    expect((await target.get("shared"))?.name).toBe("Imported shared");
  });

  it("rejects invalid and stale previews before partial writes", async () => {
    const repository = new MemoryPaymentRepository();
    const service = createBackupService(
      repository,
      createDeterministicEnvironment(),
    );
    const invalid: ImportPreview = {
      envelope: {
        format: BACKUP_FORMAT,
        version: CURRENT_BACKUP_VERSION,
        exportedAt: "2026-09-03T09:00:00.000Z",
      },
      validRecords: [],
      invalidRecords: [{ index: 0, errors: [] }],
      newRecords: [],
      conflicts: [],
    };
    await expect(service.applyMerge(invalid)).rejects.toEqual(
      new ApplicationError("invalid-data"),
    );

    const text = (
      await createBackupService(
        new MemoryPaymentRepository([record("a"), record("b")]),
        createDeterministicEnvironment(),
      ).export()
    ).contents;
    const stale = await service.preview(text);
    await repository.create(record("a"));
    await expect(service.applyMerge(stale)).rejects.toEqual(
      new ApplicationError("conflict"),
    );
    expect(await repository.get("b")).toBeUndefined();
  });
});

describe("application service initialization and errors", () => {
  it("maps initialization failures and closes repositories once", async () => {
    const initializeFailure = createApplicationInitializer({
      storageFactory: async () => {
        throw new StorageError("unavailable");
      },
    });
    await expect(initializeFailure()).rejects.toEqual(
      new ApplicationError("storage-unavailable"),
    );

    const close = vi.fn();
    const services = createApplicationServices(
      repositories(new MemoryPaymentRepository(), close),
      createDeterministicEnvironment(),
    );
    services.close();
    services.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it("maps quota and transaction errors to display-safe application codes", () => {
    expect(toServiceError(new StorageError("quota"))).toEqual(
      new ApplicationError("quota-exceeded"),
    );
    expect(toServiceError(new StorageError("transaction"))).toEqual(
      new ApplicationError("operation-failed"),
    );
  });
});
