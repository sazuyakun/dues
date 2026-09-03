import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  createFakeSettingsService,
  createTestApplicationServices,
} from "../../app/testing";
import { renderApplication } from "../../test/renderApplication";

describe("first-use onboarding", () => {
  it("persists the currency and opens the first-payment route", async () => {
    const settings = createFakeSettingsService();
    const services = createTestApplicationServices({ settings });
    renderApplication({ services, initialEntries: ["/payments"] });

    expect(
      await screen.findByText(
        /keeps recurring-payment details in this browser/i,
      ),
    ).toBeInTheDocument();
    const currency = screen.getByRole("combobox", {
      name: "Default currency",
    });
    fireEvent.change(currency, { target: { value: "INR" } });

    await waitFor(async () => {
      expect((await settings.get()).defaultCurrency).toBe("INR");
      expect(currency).not.toBeDisabled();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Save and add first payment" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Add payment" }),
    ).toBeInTheDocument();
    expect((await settings.get()).onboardingComplete).toBe(true);
  });

  it("resumes with a selection saved before completion", async () => {
    const settings = createFakeSettingsService();
    const services = createTestApplicationServices({ settings });
    const firstRender = renderApplication({ services });
    const currency = await screen.findByRole("combobox", {
      name: "Default currency",
    });
    fireEvent.change(currency, { target: { value: "EUR" } });
    await waitFor(async () => {
      expect((await settings.get()).defaultCurrency).toBe("EUR");
    });
    firstRender.unmount();

    renderApplication({ services });
    expect(
      await screen.findByRole("combobox", { name: "Default currency" }),
    ).toHaveValue("EUR");
    expect((await settings.get()).onboardingComplete).toBe(false);
  });
});
