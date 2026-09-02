import type { CurrencyCode, PaymentId, RecurringPayment } from "@dues/core";

export type {
  CalendarDate,
  CurrencyCode,
  MinorUnitAmount,
  PaymentId,
  PaymentStatus,
  Recurrence,
  RecurringPayment,
} from "@dues/core";

export type ThemeSetting = "light" | "dark" | "system";

export type PaymentInput = RecurringPayment;

export type PaymentRecord = RecurringPayment & {
  readonly createdAt: string;
  readonly updatedAt: string;
};

export interface AppSettings {
  readonly onboardingComplete: boolean;
  readonly defaultCurrency: CurrencyCode;
  readonly theme: ThemeSetting;
}

export type AppSettingsPatch = Partial<AppSettings>;

export interface UpdatePaymentOptions {
  readonly expectedUpdatedAt?: string;
}

export type BulkMutation =
  | { readonly type: "create"; readonly payment: PaymentRecord }
  | {
      readonly type: "update";
      readonly payment: PaymentRecord;
      readonly expectedUpdatedAt: string;
    }
  | {
      readonly type: "delete";
      readonly id: PaymentId;
      readonly expectedUpdatedAt?: string;
    };

export interface PaymentRepository {
  create(payment: PaymentInput): Promise<PaymentRecord>;
  get(id: PaymentId): Promise<PaymentRecord | undefined>;
  list(): Promise<readonly PaymentRecord[]>;
  update(
    id: PaymentId,
    changes: Partial<Omit<RecurringPayment, "id">>,
    options?: UpdatePaymentOptions,
  ): Promise<PaymentRecord>;
  archive(
    id: PaymentId,
    options?: UpdatePaymentOptions,
  ): Promise<PaymentRecord>;
  restore(
    id: PaymentId,
    options?: UpdatePaymentOptions,
  ): Promise<PaymentRecord>;
  delete(id: PaymentId, options?: UpdatePaymentOptions): Promise<void>;
  applyBulk(mutations: readonly BulkMutation[]): Promise<void>;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(changes: AppSettingsPatch): Promise<AppSettings>;
}

export interface StorageRepositories {
  readonly payments: PaymentRepository;
  readonly settings: SettingsRepository;
  close(): void;
}
