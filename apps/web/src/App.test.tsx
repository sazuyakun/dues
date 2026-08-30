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

  it("defaults to the night theme and persists a new selection", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("radio", { name: /night/i })).toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: /paper/i }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });
});
