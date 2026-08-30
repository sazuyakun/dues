import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { THEME_STORAGE_KEY } from "./theme";

describe("application shell", () => {
  beforeEach(() => localStorage.clear());

  it("renders the upcoming route and navigation", () => {
    render(
      <MemoryRouter initialEntries={["/upcoming"]}>
        <App />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Know what's due." }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /payments/i }).length,
    ).toBeGreaterThan(0);
  });

  it("persists a selected theme", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("radio", { name: /dark/i }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });
});
