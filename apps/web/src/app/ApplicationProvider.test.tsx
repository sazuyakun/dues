import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApplicationProvider } from "./ApplicationProvider";
import { ApplicationStartup } from "./ApplicationStartup";
import { useApplicationServices } from "./applicationContext";
import { ApplicationError } from "./errors";
import { createTestApplicationServices } from "./testing";

function ReadyView() {
  const { environment } = useApplicationServices();
  return <p>Ready for {environment.currentDate()}</p>;
}

describe("ApplicationProvider", () => {
  it("exposes initialized services and closes them on unmount", async () => {
    const close = vi.fn();
    const services = { ...createTestApplicationServices(), close };
    const { unmount } = render(
      <ApplicationProvider initialize={async () => services}>
        <ApplicationStartup>
          <ReadyView />
        </ApplicationStartup>
      </ApplicationProvider>,
    );

    expect(await screen.findByText("Ready for 2026-01-01")).toBeInTheDocument();
    unmount();
    expect(close).toHaveBeenCalledOnce();
  });

  it("shows a safe initialization error and retries", async () => {
    const services = createTestApplicationServices();
    let attempts = 0;
    const initialize = vi.fn(async () => {
      attempts += 1;
      if (attempts === 1) throw new ApplicationError("initialization-failed");
      return services;
    });

    render(
      <ApplicationProvider initialize={initialize}>
        <ApplicationStartup>
          <ReadyView />
        </ApplicationStartup>
      </ApplicationProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Dues could not open your local data",
      }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Ready for 2026-01-01")).toBeInTheDocument();
    await waitFor(() => expect(initialize).toHaveBeenCalledTimes(2));
  });

  it("never presents an unknown error message", async () => {
    render(
      <ApplicationProvider
        initialize={async () => {
          throw new Error("private database details");
        }}
      >
        <ApplicationStartup>
          <ReadyView />
        </ApplicationStartup>
      </ApplicationProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Dues ran into a problem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/private database details/i),
    ).not.toBeInTheDocument();
  });
});
