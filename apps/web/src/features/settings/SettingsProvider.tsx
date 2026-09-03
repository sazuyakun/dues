import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  presentApplicationError,
  toApplicationError,
  useApplicationServices,
  type AppSettings,
  type AppSettingsPatch,
} from "../../app/index";
import { LoadingState, StatusMessage } from "../../components";
import { applyTheme } from "../../theme";
import {
  SettingsContext,
  type SettingsContextValue,
  type SettingsNotice,
} from "./settingsContext";

type SettingsLoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly settings: AppSettings }
  | { readonly status: "error"; readonly notice: SettingsNotice };

interface SettingsProviderProps {
  readonly children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const { settings: service } = useApplicationServices();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SettingsLoadState>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [notice, setNotice] = useState<SettingsNotice>();

  useEffect(() => {
    let active = true;
    void service.get().then(
      (settings) => {
        if (active) setState({ status: "ready", settings });
      },
      (error: unknown) => {
        if (!active) return;
        const presentation = presentApplicationError(toApplicationError(error));
        setState({
          status: "error",
          notice: {
            tone: "error",
            title: presentation.title,
            message: presentation.message,
          },
        });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt, service]);

  const theme = state.status === "ready" ? state.settings.theme : undefined;
  useEffect(() => {
    if (!theme) return;
    applyTheme(theme);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const updateSystemTheme = () => {
      if (theme === "system") applyTheme(theme);
    };
    media.addEventListener("change", updateSystemTheme);
    return () => media.removeEventListener("change", updateSystemTheme);
  }, [theme]);

  const updateSettings = useCallback(
    async (changes: AppSettingsPatch): Promise<boolean> => {
      if (state.status !== "ready" || savingRef.current) return false;

      const previous = state.settings;
      const optimistic = { ...previous, ...changes };
      savingRef.current = true;
      setSaving(true);
      setNotice(undefined);
      setState({ status: "ready", settings: optimistic });
      if (changes.theme) applyTheme(changes.theme);

      try {
        const persisted = await service.update(changes);
        setState({ status: "ready", settings: persisted });
        setNotice({
          tone: "success",
          title: "Settings saved",
          message: "Saved on this device.",
        });
        return true;
      } catch (error) {
        setState({ status: "ready", settings: previous });
        if (changes.theme) applyTheme(previous.theme);
        const presentation = presentApplicationError(toApplicationError(error));
        setNotice({
          tone: "error",
          title: presentation.title,
          message: presentation.message,
        });
        return false;
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [service, state],
  );

  const clearNotice = useCallback(() => setNotice(undefined), []);

  const context = useMemo<SettingsContextValue | undefined>(
    () =>
      state.status === "ready"
        ? {
            settings: state.settings,
            saving,
            ...(notice ? { notice } : {}),
            updateSettings,
            clearNotice,
          }
        : undefined,
    [clearNotice, notice, saving, state, updateSettings],
  );

  if (state.status === "loading") {
    return <LoadingState title="Loading settings" />;
  }

  if (state.status === "error") {
    return (
      <StatusMessage tone="error" title={state.notice.title}>
        <p>{state.notice.message}</p>
        <button
          type="button"
          onClick={() => {
            setState({ status: "loading" });
            setAttempt((value) => value + 1);
          }}
        >
          Try again
        </button>
      </StatusMessage>
    );
  }

  return (
    <SettingsContext.Provider value={context}>
      {children}
    </SettingsContext.Provider>
  );
}
