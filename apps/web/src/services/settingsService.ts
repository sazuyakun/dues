import type { SettingsRepository } from "@dues/storage";
import type { SettingsService } from "../app/index";
import { runServiceOperation } from "./errors";

export function createSettingsService(
  repository: SettingsRepository,
): SettingsService {
  return {
    get: () => runServiceOperation(() => repository.get()),
    update: (changes) => runServiceOperation(() => repository.update(changes)),
  };
}
