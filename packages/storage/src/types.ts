export type PaymentId = string;
export type CalendarDate = `${number}-${number}-${number}`;
export type MinorUnitAmount = number;
export type PaymentStatus = "active" | "paused" | "archived";
export type ThemeSetting = "light" | "dark" | "system";

export type Recurrence =
  | { readonly kind: "weekly" }
  | { readonly kind: "monthly" }
  | { readonly kind: "quarterly" }
  | { readonly kind: "yearly" }
  | {
      readonly kind: "custom";
      readonly interval: number;
      readonly unit: "days" | "weeks" | "months" | "years";
    };

export interface PaymentInput {
  readonly id: PaymentId;
  readonly name: string;
  readonly amount: MinorUnitAmount;
  readonly currency: string;
  readonly recurrence: Recurrence;
  readonly nextDueDate: CalendarDate;
  readonly status: PaymentStatus;
  readonly category?: string;
  readonly paymentMethodLabel?: string;
  readonly freeTrialEndDate?: CalendarDate;
  readonly notes?: string;
  readonly providerUrl?: string;
  readonly reminderLeadDays?: number;
}

export interface PaymentRecord extends PaymentInput {
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AppSettings {
  readonly onboardingComplete: boolean;
  readonly defaultCurrency: string;
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
    changes: Partial<Omit<PaymentInput, "id">>,
    options?: UpdatePaymentOptions,
  ): Promise<PaymentRecord>;
  archive(id: PaymentId, options?: UpdatePaymentOptions): Promise<PaymentRecord>;
  restore(id: PaymentId, options?: UpdatePaymentOptions): Promise<PaymentRecord>;
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
  deleteDatabase(): Promise<void>;
}
