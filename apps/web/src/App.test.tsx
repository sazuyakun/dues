import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createFakeSettingsService,
  createTestApplicationServices,
} from "./app/testing";
import { renderApplication } from "./test/renderApplication";

describe("application shell", () => {
  const returningServices = () =>
    createTestApplicationServices({
      settings: createFakeSettingsService({
        onboardingComplete: true,
        defaultCurrency: "USD",
        theme: "system",
      }),
    });

  it.each([
    ["/upcoming", "Upcoming"],
    ["/payments", "Payments"],
    ["/add", "Add payment"],
    ["/payments/missing/edit", "Payment not found"],
    ["/backup", "Backup"],
    ["/settings", "Settings"],
  ])("composes the real route for %s", async (route, heading) => {
    renderApplication({
      services: returningServices(),
      initialEntries: [route],
    });

    expect(
      await screen.findByRole("heading", { name: heading }),
    ).toBeInTheDocument();
  });

  it("renders navigation for a returning user", async () => {
    renderApplication({
      services: returningServices(),
      initialEntries: ["/upcoming"],
    });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Upcoming",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /payments/i }).length,
    ).toBeGreaterThan(0);
  });

  it("intercepts deep links until onboarding is complete", async () => {
    renderApplication({ services: createTestApplicationServices() });
    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Set up Dues",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
  });
});
