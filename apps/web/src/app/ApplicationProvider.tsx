import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ApplicationInitializer, ApplicationServices } from "./contracts";
import { toApplicationError } from "./errors";
import {
  ApplicationContext,
  type ApplicationState,
} from "./applicationContext";

interface ApplicationProviderProps {
  readonly initialize: ApplicationInitializer;
  readonly children: ReactNode;
}

export function ApplicationProvider({
  initialize,
  children,
}: ApplicationProviderProps) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ApplicationState>({
    status: "initializing",
  });

  useEffect(() => {
    let active = true;
    let services: ApplicationServices | undefined;

    void initialize().then(
      (initializedServices) => {
        if (!active) {
          initializedServices.close();
          return;
        }
        services = initializedServices;
        setState({ status: "ready", services: initializedServices });
      },
      (error: unknown) => {
        if (active) {
          setState({ status: "error", error: toApplicationError(error) });
        }
      },
    );

    return () => {
      active = false;
      services?.close();
    };
  }, [attempt, initialize]);

  const retry = useCallback(() => {
    setState({ status: "initializing" });
    setAttempt((value) => value + 1);
  }, []);
  const value = useMemo(() => ({ state, retry }), [retry, state]);

  return (
    <ApplicationContext.Provider value={value}>
      {children}
    </ApplicationContext.Provider>
  );
}
