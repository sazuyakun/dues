import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createFakeSettingsService,
  createTestApplicationServices,
} from "./app/testing";
import { renderApplication } from "./test/renderApplication";

describe("application shell", () => {
  it("renders the upcoming route and navigation for a returning user", async () => {
    const services = createTestApplicationServices({
      settings: createFakeSettingsService({
        onboardingComplete: true,
        defaultCurrency: "USD",
        theme: "system",
      }),
    });
    renderApplication({ services, initialEntries: ["/upcoming"] });

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Know what's due.",
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
        name: "Know what’s due. Keep it yours.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Main navigation" }),
    ).not.toBeInTheDocument();
  });
});
