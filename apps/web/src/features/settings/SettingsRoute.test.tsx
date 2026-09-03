import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AppSettings, SettingsService } from "../../app/contracts";
import { ApplicationError } from "../../app/errors";
import {
  createFakeSettingsService,
  createTestApplicationServices,
} from "../../app/testing";
import { renderApplication } from "../../test/renderApplication";

const returningSettings = () =>
  createFakeSettingsService({
    onboardingComplete: true,
    defaultCurrency: "USD",
    theme: "dark",
  });

describe("settings", () => {
  it("persists currency and applies theme changes without localStorage", async () => {
    localStorage.clear();
    const settings = returningSettings();
    renderApplication({
      services: createTestApplicationServices({ settings }),
      initialEntries: ["/settings"],
    });

    const currency = await screen.findByRole("combobox", {
      name: "Default currency",
    });
    fireEvent.change(currency, { target: { value: "INR" } });
    await waitFor(async () => {
      expect((await settings.get()).defaultCurrency).toBe("INR");
      expect(currency).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("radio", { name: /paper/i }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await waitFor(async () => {
      expect((await settings.get()).theme).toBe("light");
    });
    expect(localStorage.length).toBe(0);
  });

  it("tracks system theme changes", async () => {
    let systemIsDark = false;
    const listeners = new Set<() => void>();
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: systemIsDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_type, listener) => {
        if (typeof listener === "function") listeners.add(listener);
      },
      removeEventListener: (_type, listener) => {
        if (typeof listener === "function") listeners.delete(listener);
      },
      dispatchEvent: vi.fn(),
    }));
    const settings = createFakeSettingsService({
      onboardingComplete: true,
      defaultCurrency: "USD",
      theme: "system",
    });
    renderApplication({
      services: createTestApplicationServices({ settings }),
    });

    expect(
      await screen.findByRole("heading", { name: "Know what's due." }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "light");

    act(() => {
      systemIsDark = true;
      listeners.forEach((listener) => listener());
    });
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("locks controls while a local update is pending", async () => {
    let finishUpdate: (settings: AppSettings) => void = () => undefined;
    const pendingUpdate = new Promise<AppSettings>((resolve) => {
      finishUpdate = resolve;
    });
    const settings: SettingsService = {
      get: async () => ({
        onboardingComplete: true,
        defaultCurrency: "USD",
        theme: "dark",
      }),
      update: async () => pendingUpdate,
    };
    renderApplication({
      services: createTestApplicationServices({ settings }),
      initialEntries: ["/settings"],
    });

    const currency = await screen.findByRole("combobox", {
      name: "Default currency",
    });
    fireEvent.change(currency, { target: { value: "EUR" } });
    expect(currency).toBeDisabled();
    expect(screen.getByRole("radio", { name: /night/i })).toBeDisabled();

    await act(async () => {
      finishUpdate({
        onboardingComplete: true,
        defaultCurrency: "EUR",
        theme: "dark",
      });
      await pendingUpdate;
    });
    expect(currency).not.toBeDisabled();
    expect(
      screen.getByRole("heading", { name: "Settings saved" }),
    ).toBeInTheDocument();
  });

  it("rolls back an immediate theme update and presents safe failures", async () => {
    const settings: SettingsService = {
      get: async () => ({
        onboardingComplete: true,
        defaultCurrency: "USD",
        theme: "dark",
      }),
      update: async () => {
        throw new ApplicationError("quota-exceeded");
      },
    };
    renderApplication({
      services: createTestApplicationServices({ settings }),
      initialEntries: ["/settings"],
    });

    fireEvent.click(await screen.findByRole("radio", { name: /paper/i }));
    expect(
      await screen.findByRole("heading", {
        name: "This device is out of storage space",
      }),
    ).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("retries a failed settings load", async () => {
    let attempts = 0;
    const settings: SettingsService = {
      get: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("private database details");
        return {
          onboardingComplete: true,
          defaultCurrency: "USD",
          theme: "system",
        };
      },
      update: async () => {
        throw new Error("not used");
      },
    };
    renderApplication({
      services: createTestApplicationServices({ settings }),
    });

    expect(
      await screen.findByRole("heading", { name: "Dues ran into a problem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/private database details/i),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Know what's due." }),
    ).toBeInTheDocument();
  });
});
