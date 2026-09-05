import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ApplicationError,
  createDeterministicEnvironment,
  createFakePaymentService,
  createFakeSettingsService,
  createTestApplicationServices,
  type PaymentRecord,
} from "../../app/index";
import { paymentRecord, renderPaymentFeature } from "./testUtils";

describe("PaymentFormRoute", () => {
  it("starts new records with the persisted default currency", async () => {
    const services = createTestApplicationServices({
      settings: createFakeSettingsService({
        onboardingComplete: true,
        defaultCurrency: "INR",
        theme: "system",
      }),
    });
    renderPaymentFeature(services, "/add");

    expect(
      await screen.findByRole("combobox", { name: /currency/i }),
    ).toHaveValue("INR");
  });

  it("creates a payment from only the required fields", async () => {
    const environment = createDeterministicEnvironment({
      currentDate: "2026-09-03",
      ids: ["created-payment"],
    });
    const services = createTestApplicationServices({ environment });
    renderPaymentFeature(services, "/add");

    expect(
      await screen.findByRole("heading", { name: "Add payment" }),
    ).toBeVisible();
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Music" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /amount/i }), {
      target: { value: "25.00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));

    expect(
      await screen.findByRole("heading", { name: "Payments" }),
    ).toBeVisible();
    const [created] = await services.payments.list();
    expect(created).toMatchObject({
      id: "created-payment",
      name: "Music",
      amount: 2_500,
      currency: "USD",
      recurrence: { frequency: "monthly", anchorDay: 3 },
      nextDueDate: "2026-09-03",
      status: "active",
    });
  });

  it("creates a custom recurrence with every optional field", async () => {
    const services = createTestApplicationServices({
      environment: createDeterministicEnvironment({ ids: ["custom-payment"] }),
    });
    renderPaymentFeature(services, "/add");
    await screen.findByRole("heading", { name: "Add payment" });

    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Workspace suite" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /amount/i }), {
      target: { value: "99.50" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /currency/i }), {
      target: { value: "EUR" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /frequency/i }), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /repeat every/i }), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /interval unit/i }), {
      target: { value: "month" },
    });
    fireEvent.change(screen.getByLabelText(/next due date/i), {
      target: { value: "2026-01-31" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /^status/i }), {
      target: { value: "paused" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /category/i }), {
      target: { value: "Work" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /payment method/i }), {
      target: { value: "UPI mandate" },
    });
    fireEvent.change(screen.getByLabelText(/free-trial end date/i), {
      target: { value: "2026-01-15" },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: /reminder/i }), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /provider/i }), {
      target: { value: "https://example.com/manage" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /notes/i }), {
      target: { value: "Owner: procurement" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));

    await screen.findByText("Payment added.");
    const [created] = await services.payments.list();
    expect(created).toMatchObject({
      amount: 9_950,
      currency: "EUR",
      recurrence: {
        frequency: "custom",
        interval: { count: 2, unit: "month", anchorDay: 31 },
      },
      status: "paused",
      category: "Work",
      paymentMethodLabel: "UPI mandate",
      freeTrialEndDate: "2026-01-15",
      notes: "Owner: procurement",
      providerUrl: "https://example.com/manage",
      reminderLeadDays: 7,
    });
  });

  it("shows field-level guidance and does not submit invalid values", async () => {
    const services = createTestApplicationServices();
    const create = vi.spyOn(services.payments, "create");
    renderPaymentFeature(services, "/add");
    await screen.findByRole("heading", { name: "Add payment" });

    fireEvent.change(screen.getByRole("textbox", { name: /amount/i }), {
      target: { value: "-1.00" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /frequency/i }), {
      target: { value: "custom" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /repeat every/i }), {
      target: { value: "0" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /provider/i }), {
      target: { value: "javascript:alert(1)" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));

    expect(await screen.findByText(/check the highlighted/i)).toBeVisible();
    expect(screen.getByRole("textbox", { name: /name/i })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByRole("textbox", { name: /amount/i })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(
      screen.getByRole("textbox", { name: /repeat every/i }),
    ).toHaveAccessibleDescription(/whole interval/i);
    expect(screen.getByRole("textbox", { name: /provider/i })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(create).not.toHaveBeenCalled();
  });

  it("loads edits, clears optional fields, and preserves a month-end anchor", async () => {
    const existing = paymentRecord({
      nextDueDate: "2026-02-28",
      recurrence: { frequency: "monthly", anchorDay: 31 },
      category: "Work",
      notes: "Old note",
    });
    const services = createTestApplicationServices({
      initialPayments: [existing],
    });
    renderPaymentFeature(services, `/payments/${existing.id}/edit`);

    expect(
      await screen.findByRole("heading", { name: "Edit payment" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: /amount/i })).toHaveValue(
      "12.99",
    );
    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Updated workspace" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /category/i }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /notes/i }), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await screen.findByText("Payment saved.");
    const updated = await services.payments.get(existing.id);
    expect(updated).toMatchObject({
      name: "Updated workspace",
      recurrence: { frequency: "monthly", anchorDay: 31 },
    });
    expect(updated?.category).toBeUndefined();
    expect(updated?.notes).toBeUndefined();
  });

  it("uses an optimistic version and reloads after a conflict", async () => {
    const original = paymentRecord();
    const latest = paymentRecord({
      name: "Changed elsewhere",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    let loaded: PaymentRecord = original;
    const environment = createDeterministicEnvironment();
    const basePayments = createFakePaymentService(environment, [original]);
    const update = vi.fn(async () => {
      loaded = latest;
      throw new ApplicationError("conflict");
    });
    const services = createTestApplicationServices({
      environment,
      payments: {
        ...basePayments,
        get: vi.fn(async () => loaded),
        update,
      },
    });
    renderPaymentFeature(services, `/payments/${original.id}/edit`);
    await screen.findByDisplayValue("Workspace");

    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "My local edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(
      await screen.findByRole("button", { name: "Reload latest payment" }),
    ).toBeVisible();
    expect(update).toHaveBeenCalledWith(original.id, expect.any(Object), {
      expectedUpdatedAt: original.updatedAt,
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Reload latest payment" }),
    );
    expect(await screen.findByDisplayValue("Changed elsewhere")).toBeVisible();
  });

  it("protects a pending create and supports cancellation", async () => {
    const environment = createDeterministicEnvironment({
      ids: ["pending-payment"],
    });
    const basePayments = createFakePaymentService(environment);
    let resolveCreate: ((record: PaymentRecord) => void) | undefined;
    const create = vi.fn(
      () =>
        new Promise<PaymentRecord>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const services = createTestApplicationServices({
      environment,
      payments: { ...basePayments, create },
    });
    const pendingView = renderPaymentFeature(services, "/add");
    await screen.findByRole("heading", { name: "Add payment" });

    fireEvent.change(screen.getByRole("textbox", { name: /name/i }), {
      target: { value: "Pending payment" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /amount/i }), {
      target: { value: "10.00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add payment" }));

    expect(
      await screen.findByRole("button", { name: "Adding payment…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await act(async () => {
      resolveCreate?.(
        paymentRecord({ id: "pending-payment", name: "Pending payment" }),
      );
    });
    expect(
      await screen.findByRole("heading", { name: "Payments" }),
    ).toBeVisible();
    pendingView.unmount();

    const cancellationServices = createTestApplicationServices();
    const cancelledCreate = vi.spyOn(cancellationServices.payments, "create");
    renderPaymentFeature(cancellationServices, "/add");
    await screen.findByRole("heading", { name: "Add payment" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      await screen.findByRole("heading", { name: "Payments" }),
    ).toBeVisible();
    expect(cancelledCreate).not.toHaveBeenCalled();
  });

  it("shows a safe not-found state for a missing edit target", async () => {
    const services = createTestApplicationServices();
    renderPaymentFeature(services, "/payments/missing/edit");

    expect(
      await screen.findByRole("heading", { name: "Payment not found" }),
    ).toBeVisible();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
});
