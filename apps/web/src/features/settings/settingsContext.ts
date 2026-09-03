import { createContext, useContext } from "react";
import type { AppSettings, AppSettingsPatch } from "../../app/index";

export interface SettingsNotice {
  readonly tone: "success" | "error";
  readonly title: string;
  readonly message: string;
}

export interface SettingsContextValue {
  readonly settings: AppSettings;
  readonly saving: boolean;
  readonly notice?: SettingsNotice;
  updateSettings(changes: AppSettingsPatch): Promise<boolean>;
  clearNotice(): void;
}

export const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}
