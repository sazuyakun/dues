import { describe, expect, it } from "vitest";
import { ApplicationError } from "./errors";
import {
  createDeterministicEnvironment,
  createFakePaymentService,
} from "./testing";

describe("application test doubles", () => {
  it("uses deterministic IDs and rejects stale mutations", async () => {
    const environment = createDeterministicEnvironment({
      ids: ["payment-7"],
      instants: ["2026-01-01T00:00:00.000Z", "2026-01-02T00:00:00.000Z"],
    });
    const payments = createFakePaymentService(environment);
    const created = await payments.create({
      name: "Internet",
      amount: 4999,
      currency: "USD",
      recurrence: { frequency: "monthly" },
      nextDueDate: "2026-01-31",
      status: "active",
    });

    expect(created).toMatchObject({
      id: "payment-7",
      recurrence: { frequency: "monthly", anchorDay: 31 },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const paused = await payments.pause(created.id, {
      expectedUpdatedAt: created.updatedAt,
    });
    expect(paused).toMatchObject({
      status: "paused",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });

    await expect(
      payments.archive(created.id, {
        expectedUpdatedAt: created.updatedAt,
      }),
    ).rejects.toEqual(new ApplicationError("conflict"));
  });

  it("applies canonical create and edit validation", async () => {
    const environment = createDeterministicEnvironment();
    const payments = createFakePaymentService(environment);

    await expect(
      payments.create({
        name: " ",
        amount: 100,
        currency: "USD",
        recurrence: { frequency: "weekly" },
        nextDueDate: "2026-01-01",
        status: "active",
      }),
    ).rejects.toEqual(new ApplicationError("invalid-data"));

    const created = await payments.create({
      name: "Hosting",
      amount: 100,
      currency: "USD",
      recurrence: { frequency: "weekly" },
      nextDueDate: "2026-01-01",
      status: "active",
    });

    await expect(
      payments.update(
        created.id,
        {},
        {
          expectedUpdatedAt: created.updatedAt,
        },
      ),
    ).rejects.toEqual(new ApplicationError("invalid-data"));
  });
});
