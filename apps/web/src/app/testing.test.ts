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
      recurrence: { frequency: "monthly", anchorDay: 31 },
      nextDueDate: "2026-01-31",
      status: "active",
    });

    expect(created).toMatchObject({
      id: "payment-7",
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
});
