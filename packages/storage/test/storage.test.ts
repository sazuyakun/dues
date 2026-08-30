import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  createStorage,
  StorageError,
  type PaymentInput,
  type PaymentRecord,
  type StorageRepositories,
} from "../src/index.js";

const databases: Array<{ readonly name: string; readonly storage: StorageRepositories }> = [];
let sequence = 0;

function payment(id: string, overrides: Partial<PaymentInput> = {}): PaymentInput {
  return {
    id,
    name: `Payment ${id}`,
    amount: 1299,
    currency: "USD",
    recurrence: { frequency: "monthly", anchorDay: 15 },
    nextDueDate: "2026-09-15",
    status: "active",
    ...overrides,
  };
}

async function storage(now = () => new Date("2026-08-30T10:00:00.000Z")) {
  const name = `dues-test-${sequence++}`;
  const instance = await createStorage({ databaseName: name, now });
  databases.push({ name, storage: instance });
  return instance;
}

afterEach(async () => {
  await Promise.all(
    databases.splice(0).map(async ({ name, storage: instance }) => {
      instance.close();
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }),
  );
});

describe("payment repository", () => {
  it("creates, reads, updates, archives, restores, lists, and deletes payments", async () => {
    let instant = "2026-08-30T10:00:00.000Z";
    const repositories = await storage(() => new Date(instant));
    const created = await repositories.payments.create(payment("b", { notes: "private" }));
    await repositories.payments.create(payment("a", { nextDueDate: "2026-09-01" }));

    expect(created.createdAt).toBe(instant);
    expect(created.updatedAt).toBe(instant);
    expect((await repositories.payments.list()).map(({ id }) => id)).toEqual(["a", "b"]);

    instant = "2026-08-31T10:00:00.000Z";
    const updated = await repositories.payments.update(
      "b",
      { amount: 1500 },
      { expectedUpdatedAt: created.updatedAt },
    );
    expect(updated).toMatchObject({ amount: 1500, notes: "private" });
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt).toBe(instant);

    const archived = await repositories.payments.archive("b");
    expect(archived.status).toBe("archived");
    expect((await repositories.payments.restore("b")).status).toBe("active");
    await repositories.payments.delete("b");
    expect(await repositories.payments.get("b")).toBeUndefined();
  });

  it("rejects duplicate IDs and stale updates without overwriting", async () => {
    const repositories = await storage();
    const created = await repositories.payments.create(payment("same"));

    await expect(repositories.payments.create(payment("same"))).rejects.toMatchObject({
      code: "duplicate",
    });
    await repositories.payments.update("same", { name: "new" });
    await expect(
      repositories.payments.update("same", { name: "stale" }, { expectedUpdatedAt: created.updatedAt }),
    ).rejects.toMatchObject({ code: "conflict" });
    expect((await repositories.payments.get("same"))?.name).toBe("new");
  });

  it("preserves data after close and reopen", async () => {
    const name = `dues-reopen-${sequence++}`;
    const first = await createStorage({ databaseName: name });
    databases.push({ name, storage: first });
    await first.payments.create(payment("persisted"));
    await first.settings.update({ onboardingComplete: true, defaultCurrency: "INR" });
    first.close();

    const reopened = await createStorage({ databaseName: name });
    databases[databases.length - 1] = { name, storage: reopened };
    expect((await reopened.payments.get("persisted"))?.name).toBe("Payment persisted");
    expect(await reopened.settings.get()).toMatchObject({
      onboardingComplete: true,
      defaultCurrency: "INR",
    });
  });

  it("applies an approved bulk plan atomically", async () => {
    const repositories = await storage();
    const old = await repositories.payments.create(payment("old"));
    const imported: PaymentRecord = {
      ...payment("new"),
      createdAt: "2025-01-01T00:00:00.000Z",
      updatedAt: "2025-01-01T00:00:00.000Z",
    };
    const changed: PaymentRecord = { ...old, name: "changed", updatedAt: "2026-09-01T00:00:00.000Z" };

    await repositories.payments.applyBulk([
      { type: "create", payment: imported },
      { type: "update", payment: changed, expectedUpdatedAt: old.updatedAt },
    ]);
    expect(await repositories.payments.get("new")).toEqual(imported);
    expect(await repositories.payments.get("old")).toEqual(changed);
  });

  it("does not write any part of a bulk plan when validation fails", async () => {
    const repositories = await storage();
    const old = await repositories.payments.create(payment("old"));
    const imported: PaymentRecord = {
      ...payment("new"),
      createdAt: old.createdAt,
      updatedAt: old.updatedAt,
    };

    await expect(
      repositories.payments.applyBulk([
        { type: "create", payment: imported },
        { type: "delete", id: "missing" },
      ]),
    ).rejects.toMatchObject({ code: "not-found" });
    expect(await repositories.payments.get("new")).toBeUndefined();
    expect(await repositories.payments.get("old")).toEqual(old);
  });

  it("rolls back earlier writes when IndexedDB rejects a later bulk mutation", async () => {
    const repositories = await storage();
    const valid: PaymentRecord = {
      ...payment("valid"),
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const uncloneable: PaymentRecord = {
      ...payment("uncloneable"),
      // Simulate a low-level IndexedDB write failure after preflight validation.
      notes: (() => undefined) as unknown as string,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    await expect(
      repositories.payments.applyBulk([
        { type: "create", payment: valid },
        { type: "create", payment: uncloneable },
      ]),
    ).rejects.toMatchObject({ code: "transaction" });
    expect(await repositories.payments.get("valid")).toBeUndefined();
    expect(await repositories.payments.get("uncloneable")).toBeUndefined();
  });

  it("rejects duplicate IDs inside one bulk plan", async () => {
    const repositories = await storage();
    const record: PaymentRecord = {
      ...payment("duplicate"),
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await expect(
      repositories.payments.applyBulk([
        { type: "create", payment: record },
        { type: "create", payment: record },
      ]),
    ).rejects.toBeInstanceOf(StorageError);
  });
});

describe("settings repository", () => {
  it("stores onboarding, currency, and theme settings", async () => {
    const repositories = await storage();
    expect(await repositories.settings.get()).toEqual({
      onboardingComplete: false,
      defaultCurrency: "USD",
      theme: "system",
    });
    expect(
      await repositories.settings.update({
        onboardingComplete: true,
        defaultCurrency: "INR",
        theme: "dark",
      }),
    ).toEqual({ onboardingComplete: true, defaultCurrency: "INR", theme: "dark" });
  });
});

describe("initialization", () => {
  it("returns a display-safe error when IndexedDB is unavailable", async () => {
    const availableIndexedDb = globalThis.indexedDB;
    Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: undefined });
    try {
      await expect(createStorage()).rejects.toEqual(
        expect.objectContaining({
          code: "unavailable",
          message: "Local storage is unavailable in this browser.",
        }),
      );
    } finally {
      Object.defineProperty(globalThis, "indexedDB", {
        configurable: true,
        value: availableIndexedDb,
      });
    }
  });
});
