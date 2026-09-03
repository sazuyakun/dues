import {
  createStorage,
  type StorageOptions,
  type StorageRepositories,
} from "@dues/storage";
import type {
  ApplicationEnvironment,
  ApplicationInitializer,
  ApplicationServices,
} from "../app/index";
import { createBackupService } from "./backupService";
import { createBrowserEnvironment } from "./environment";
import { toServiceError } from "./errors";
import { createPaymentService } from "./paymentService";
import { createSettingsService } from "./settingsService";

export type StorageFactory = (
  options: StorageOptions,
) => Promise<StorageRepositories>;

export interface ApplicationInitializerOptions {
  readonly environment?: ApplicationEnvironment;
  readonly storage?: Omit<StorageOptions, "now">;
  readonly storageFactory?: StorageFactory;
}

export function createApplicationServices(
  repositories: StorageRepositories,
  environment: ApplicationEnvironment,
): ApplicationServices {
  let closed = false;
  return {
    environment,
    payments: createPaymentService(repositories.payments, environment),
    settings: createSettingsService(repositories.settings),
    backup: createBackupService(repositories.payments, environment),
    close: () => {
      if (closed) return;
      closed = true;
      repositories.close();
    },
  };
}

export function createApplicationInitializer(
  options: ApplicationInitializerOptions = {},
): ApplicationInitializer {
  const environment = options.environment ?? createBrowserEnvironment();
  const storageFactory = options.storageFactory ?? createStorage;

  return async () => {
    try {
      const repositories = await storageFactory({
        ...options.storage,
        now: environment.now,
      });
      return createApplicationServices(repositories, environment);
    } catch (error) {
      throw toServiceError(error);
    }
  };
}
