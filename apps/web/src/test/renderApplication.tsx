import { render, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { App } from "../App";
import {
  ApplicationProvider,
  ApplicationStartup,
  type ApplicationServices,
} from "../app/index";
import { SettingsProvider } from "../features/settings";

interface RenderApplicationOptions {
  readonly services: ApplicationServices;
  readonly initialEntries?: readonly string[];
}

export function renderApplication({
  services,
  initialEntries = ["/"],
}: RenderApplicationOptions): RenderResult {
  return render(
    <ApplicationProvider initialize={async () => services}>
      <ApplicationStartup>
        <MemoryRouter initialEntries={[...initialEntries]}>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </MemoryRouter>
      </ApplicationStartup>
    </ApplicationProvider>,
  );
}
