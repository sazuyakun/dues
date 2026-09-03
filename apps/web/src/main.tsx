import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { ApplicationProvider, ApplicationStartup } from "./app/index";
import { SettingsProvider } from "./features/settings";
import { createApplicationInitializer } from "./services";
import { applyTheme } from "./theme";
import "./styles.css";

registerSW({ immediate: true });
applyTheme("system");

const initializeApplication = createApplicationInitializer();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApplicationProvider initialize={initializeApplication}>
      <ApplicationStartup>
        <BrowserRouter>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </BrowserRouter>
      </ApplicationStartup>
    </ApplicationProvider>
  </StrictMode>,
);
