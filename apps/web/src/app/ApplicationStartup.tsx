import type { ReactNode } from "react";
import { LoadingState, StatusMessage } from "../components";
import { useApplication } from "./applicationContext";
import { presentApplicationError } from "./errors";

interface ApplicationStartupProps {
  readonly children: ReactNode;
}

export function ApplicationStartup({ children }: ApplicationStartupProps) {
  const { state, retry } = useApplication();

  if (state.status === "initializing") {
    return (
      <LoadingState
        title="Opening your local register"
        message="Dues is preparing data stored on this device."
      />
    );
  }

  if (state.status === "error") {
    const presentation = presentApplicationError(state.error);
    return (
      <StatusMessage tone="error" title={presentation.title}>
        <p>{presentation.message}</p>
        {presentation.retryable && (
          <button type="button" onClick={retry}>
            Try again
          </button>
        )}
      </StatusMessage>
    );
  }

  return children;
}
