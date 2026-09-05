import { validateRecurringPayment, type RecurringPayment } from "@dues/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
  ApplicationError,
  ApplicationProvider,
  ApplicationStartup,
  createDeterministicEnvironment,
  createFakePaymentService,
  createTestApplicationServices,
  type ApplicationServices,
  type PaymentRecord,
} from "../../app/index";
import { UpcomingRoute } from "./UpcomingRoute";

function payment(
  id: string,
  nextDueDate: RecurringPayment["nextDueDate"],
  overrides: Partial<RecurringPayment> = {},
): PaymentRecord {
  const [, month, day] = nextDueDate.split("-");
  return {
    ...validateRecurringPayment({
      id,
      name: `Payment ${id}`,
      amount: 1_000,
      currency: "USD",
      recurrence: {
        frequency: "yearly",
        anchorMonth: Number(month),
        anchorDay: Number(day),
      },
      nextDueDate,
      status: "active",
      ...overrides,
    }),
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function renderUpcoming(services: ApplicationServices) {
  return render(
    <MemoryRouter>
      <ApplicationProvider initialize={async () => services}>
        <ApplicationStartup>
          <UpcomingRoute />
        </ApplicationStartup>
      </ApplicationProvider>
    </MemoryRouter>,
  );
}

describe("UpcomingRoute", () => {
  it("renders every populated group, separated totals, and reminder guidance", async () => {
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
    });
    const services = createTestApplicationServices({
      environment,
      initialPayments: [
        payment("overdue", "2026-09-01"),
        payment("today", "2026-09-03", { currency: "INR" }),
        payment("next", "2026-09-10", { reminderLeadDays: 7 }),
        payment("later", "2026-09-20", { currency: "INR" }),
        payment("beyond", "2026-10-01", { currency: "EUR" }),
        payment("paused", "2026-09-04", { status: "paused" }),
        payment("archived", "2026-09-05", { status: "archived" }),
      ],
    });
    renderUpcoming(services);

    for (const name of [
      "Overdue",
      "Today",
      "Next seven days",
      "Later this month",
      "Beyond",
    ]) {
      expect(await screen.findByRole("heading", { name })).toBeInTheDocument();
    }
    expect(screen.getByText("Payment overdue")).toBeInTheDocument();
    expect(screen.queryByText("Payment paused")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment archived")).not.toBeInTheDocument();

    const month = screen.getByRole("region", { name: "Current month" });
    expect(within(month).getByText("USD")).toBeInTheDocument();
    expect(within(month).getByText("INR")).toBeInTheDocument();
    expect(within(month).queryByText("EUR")).not.toBeInTheDocument();
    const year = screen.getByRole("region", { name: "Current year" });
    expect(within(year).getByText("EUR")).toBeInTheDocument();
    expect(screen.getByText("Reminder window · 7 days")).toBeInTheDocument();
    expect(
      screen.getByText(/reminder flags appear while dues is open/i),
    ).toBeInTheDocument();
  });

  it("protects a pending mark-paid action and announces the next due date", async () => {
    const due = payment("overdue", "2026-01-31", {
      recurrence: { frequency: "monthly", anchorDay: 31 },
    });
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
    });
    const base = createFakePaymentService(environment, [due]);
    let resolveMarkPaid: ((record: PaymentRecord) => void) | undefined;
    const markPaid = vi.fn(
      () =>
        new Promise<PaymentRecord>((resolve) => {
          resolveMarkPaid = resolve;
        }),
    );
    const services = createTestApplicationServices({
      environment,
      payments: { ...base, markPaid },
    });
    renderUpcoming(services);

    const button = await screen.findByRole("button", {
      name: "Mark Payment overdue paid",
    });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Marking…");
    fireEvent.click(button);
    expect(markPaid).toHaveBeenCalledOnce();

    resolveMarkPaid?.({
      ...due,
      nextDueDate: "2026-09-30",
      updatedAt: "2026-09-03T10:00:00.000Z",
    });
    expect(
      await screen.findByText(
        "Payment overdue was marked paid. Next due 2026-09-30.",
      ),
    ).toBeInTheDocument();
  });

  it("reloads the latest record when mark-paid encounters a conflict", async () => {
    const current = payment("conflict", "2026-09-01");
    const latest = {
      ...current,
      nextDueDate: "2026-10-01" as const,
      updatedAt: "2026-09-03T10:00:00.000Z",
    };
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
    });
    const base = createFakePaymentService(environment, [current]);
    const list = vi
      .fn()
      .mockResolvedValueOnce([current])
      .mockResolvedValueOnce([latest]);
    const services = createTestApplicationServices({
      environment,
      payments: {
        ...base,
        list,
        markPaid: vi.fn().mockRejectedValue(new ApplicationError("conflict")),
      },
    });
    renderUpcoming(services);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Mark Payment conflict paid",
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "This payment changed" }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Due 2026-10-01/)).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("distinguishes no payments from no active upcoming payments", async () => {
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
    });
    const first = renderUpcoming(
      createTestApplicationServices({ environment, initialPayments: [] }),
    );
    expect(
      await screen.findByRole("heading", { name: "No payments yet" }),
    ).toBeInTheDocument();
    first.unmount();

    renderUpcoming(
      createTestApplicationServices({
        environment,
        initialPayments: [
          payment("paused", "2026-09-04", { status: "paused" }),
          payment("archived", "2026-09-05", { status: "archived" }),
        ],
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "No upcoming payments" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Payment paused")).not.toBeInTheDocument();
  });

  it("shows loading and retries a display-safe read failure", async () => {
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
    });
    const base = createFakePaymentService(environment);
    let rejectFirstLoad: ((error: ApplicationError) => void) | undefined;
    const firstLoad = new Promise<readonly PaymentRecord[]>((_, reject) => {
      rejectFirstLoad = reject;
    });
    const list = vi
      .fn()
      .mockReturnValueOnce(firstLoad)
      .mockResolvedValueOnce([]);
    renderUpcoming(
      createTestApplicationServices({
        environment,
        payments: { ...base, list },
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Loading upcoming payments" }),
    ).toBeInTheDocument();
    await act(async () => {
      rejectFirstLoad?.(new ApplicationError("operation-failed"));
    });
    expect(
      await screen.findByRole("heading", {
        name: "The operation could not be completed",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "No payments yet" }),
    ).toBeInTheDocument();
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("presents a safe error if period totals exceed the safe integer range", async () => {
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
    });
    renderUpcoming(
      createTestApplicationServices({
        environment,
        initialPayments: [
          payment("large-a", "2026-09-03", {
            amount: Number.MAX_SAFE_INTEGER,
          }),
          payment("large-b", "2026-09-03", {
            amount: Number.MAX_SAFE_INTEGER,
          }),
        ],
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "Dues ran into a problem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/exceeds the safe integer range/i),
    ).not.toBeInTheDocument();
  });
});
