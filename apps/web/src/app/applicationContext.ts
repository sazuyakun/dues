import { createContext, useContext } from "react";
import type { ApplicationServices } from "./contracts";
import type { ApplicationError } from "./errors";

export type ApplicationState =
  | { readonly status: "initializing" }
  | { readonly status: "ready"; readonly services: ApplicationServices }
  | { readonly status: "error"; readonly error: ApplicationError };

export interface ApplicationContextValue {
  readonly state: ApplicationState;
  retry(): void;
}

export const ApplicationContext = createContext<
  ApplicationContextValue | undefined
>(undefined);

export function useApplication(): ApplicationContextValue {
  const application = useContext(ApplicationContext);
  if (!application) {
    throw new Error("useApplication must be used within ApplicationProvider");
  }
  return application;
}

export function useApplicationServices(): ApplicationServices {
  const { state } = useApplication();
  if (state.status !== "ready") {
    throw new Error("Application services are not ready");
  }
  return state.services;
}
