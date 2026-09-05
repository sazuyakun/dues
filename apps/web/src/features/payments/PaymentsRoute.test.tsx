import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  ApplicationError,
  createDeterministicEnvironment,
  createFakePaymentService,
  createTestApplicationServices,
} from "../../app/index";
import { paymentRecord, renderPaymentFeature } from "./testUtils";

describe("PaymentsRoute", () => {
  const records = [
    paymentRecord({
      id: "active-work",
      name: "Cloud host",
      category: "Work",
      notes: "Legacy server",
      providerUrl: "https://example.com/billing",
    }),
    paymentRecord({
      id: "paused-personal",
      name: "Music",
      category: "Personal",
      status: "paused",
    }),
    paymentRecord({
      id: "archived-work",
      name: "Old domain",
      category: "Work",
      status: "archived",
    }),
  ];

  it("searches and filters through the core query contract", async () => {
    const services = createTestApplicationServices({
      initialPayments: records,
    });
    renderPaymentFeature(services, "/payments");
    await screen.findByRole("heading", { name: "Payments" });

    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), {
      target: { value: "LEGACY" },
    });
    expect(screen.getByRole("heading", { name: "Cloud host" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Music" }),
    ).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: /search/i }), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Category" }), {
      target: { value: "Work" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
      target: { value: "archived" },
    });
    expect(screen.getByRole("heading", { name: "Old domain" })).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Cloud host" }),
    ).not.toBeInTheDocument();
  });

  it("renders validated provider links with safe external behavior", async () => {
    const services = createTestApplicationServices({
      initialPayments: records,
    });
    renderPaymentFeature(services, "/payments");

    const provider = await screen.findByRole("link", {
      name: "Manage at provider",
    });
    expect(provider).toHaveAttribute("href", "https://example.com/billing");
    expect(provider).toHaveAttribute("target", "_blank");
    expect(provider).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("pauses, resumes, archives, and restores with current versions", async () => {
    const services = createTestApplicationServices({
      initialPayments: [records[0]!],
    });
    renderPaymentFeature(services, "/payments");
    await screen.findByRole("heading", { name: "Cloud host" });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    expect(await screen.findByText("Cloud host is paused.")).toBeVisible();
    expect(screen.getByText("paused")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(
      await screen.findByText("Cloud host is active again."),
    ).toBeVisible();
    expect(screen.getByText("active")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(
      await screen.findByText("Cloud host moved to the archive."),
    ).toBeVisible();
    expect(screen.getByText("archived")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(
      await screen.findByText("Cloud host is active again."),
    ).toBeVisible();
    expect(screen.getByText("active")).toBeVisible();
  });

  it("prevents overlapping mutations while an action is pending", async () => {
    const active = records[0]!;
    const environment = createDeterministicEnvironment();
    const basePayments = createFakePaymentService(
      environment,
      records.slice(0, 2),
    );
    let resolvePause:
      ((payment: ReturnType<typeof paymentRecord>) => void) | undefined;
    const pause = vi.fn(
      () =>
        new Promise<ReturnType<typeof paymentRecord>>((resolve) => {
          resolvePause = resolve;
        }),
    );
    const services = createTestApplicationServices({
      environment,
      payments: { ...basePayments, pause },
    });
    renderPaymentFeature(services, "/payments");
    await screen.findByRole("heading", { name: "Cloud host" });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(
      await screen.findByRole("button", { name: "Pausing…" }),
    ).toBeDisabled();
    for (const button of screen.getAllByRole("button", {
      name: "Delete permanently",
    })) {
      expect(button).toBeDisabled();
    }

    await act(async () => {
      resolvePause?.(
        paymentRecord({
          ...active,
          status: "paused",
          updatedAt: "2026-01-02T00:00:00.000Z",
        }),
      );
    });
    expect(await screen.findByText("Cloud host is paused.")).toBeVisible();
  });

  it("requires explicit confirmation before permanent deletion", async () => {
    const services = createTestApplicationServices({
      initialPayments: [records[0]!],
    });
    const remove = vi.spyOn(services.payments, "delete");
    renderPaymentFeature(services, "/payments");
    await screen.findByRole("heading", { name: "Cloud host" });

    fireEvent.click(screen.getByRole("button", { name: "Delete permanently" }));
    const dialog = screen.getByRole("alertdialog");
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Delete permanently" }),
    );

    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    expect(
      await screen.findByText("Cloud host was permanently deleted."),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "Cloud host" }),
    ).not.toBeInTheDocument();
  });

  it("reloads the register after an optimistic conflict", async () => {
    const active = records[0]!;
    const paused = paymentRecord({
      ...active,
      status: "paused",
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    let listResult = [active];
    const environment = createDeterministicEnvironment();
    const basePayments = createFakePaymentService(environment, [active]);
    const list = vi.fn(async () => listResult);
    const pause = vi.fn(async () => {
      listResult = [paused];
      throw new ApplicationError("conflict");
    });
    const services = createTestApplicationServices({
      environment,
      payments: { ...basePayments, list, pause },
    });
    renderPaymentFeature(services, "/payments");
    await screen.findByRole("heading", { name: "Cloud host" });

    fireEvent.click(screen.getByRole("button", { name: "Pause" }));

    expect(await screen.findByText(/the list was reloaded/i)).toBeVisible();
    expect(screen.getByText("paused")).toBeVisible();
    expect(list).toHaveBeenCalledTimes(2);
    expect(pause).toHaveBeenCalledWith(active.id, {
      expectedUpdatedAt: active.updatedAt,
    });
  });

  it("shows an actionable empty state", async () => {
    const services = createTestApplicationServices();
    renderPaymentFeature(services, "/payments");

    expect(
      await screen.findByRole("heading", { name: "No payments" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Add a payment" })).toHaveAttribute(
      "href",
      "/add",
    );
  });
});
