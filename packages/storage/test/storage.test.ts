import "fake-indexeddb/auto";

import { afterEach, describe, expect, it } from "vitest";

import {
  createStorage,
  StorageError,
  type PaymentInput,
  type PaymentRecord,
  type StorageRepositories,
} from "../src/index.js";

const databases: StorageRepositories[] = [];
let sequence = 0;

function payment(id: string, overrides: Partial<PaymentInput> = {}): PaymentInput {
  return {
    id,
    name: `Payment ${id}`,
    amount: 1299,
    currency: "USD",
    recurrence: { kind: "monthly" },
    nextDueDate: "2026-09-15",
    status: "active",
    ...overrides,
  };
}

async function storage(now = () => new Date("2026-08-30T10:00:00.000Z")) {
  const instance = await createStorage({ databaseName: `dues-test-${sequence++}`, now });
  databases.push(instance);
  return instance;
}

afterEach(async () => {
  await Promise.all(databases.splice(0).map((database) => database.deleteDatabase()));
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
    await first.payments.create(payment("persisted"));
    first.close();

    const reopened = await createStorage({ databaseName: name });
    databases.push(reopened);
    expect((await reopened.payments.get("persisted"))?.name).toBe("Payment persisted");
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

  it("rolls back every bulk mutation when validation fails", async () => {
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
