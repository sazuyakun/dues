import type { ImportPreview } from "@dues/backup";
import type { CalendarDate, PaymentId, RecurringPayment } from "@dues/core";
import type { AppSettings, AppSettingsPatch } from "@dues/storage";

export type PaymentRecord = RecurringPayment & {
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type NewPaymentInput = Omit<RecurringPayment, "id">;

export type PaymentChanges = Partial<Omit<RecurringPayment, "id">>;

export interface ExpectedPaymentVersion {
  readonly expectedUpdatedAt: string;
}

export interface MarkPaidInput extends ExpectedPaymentVersion {
  readonly paidThrough?: CalendarDate;
}

export interface PaymentService {
  list(): Promise<readonly PaymentRecord[]>;
  get(id: PaymentId): Promise<PaymentRecord | undefined>;
  create(input: NewPaymentInput): Promise<PaymentRecord>;
  update(
    id: PaymentId,
    changes: PaymentChanges,
    version: ExpectedPaymentVersion,
  ): Promise<PaymentRecord>;
  markPaid(id: PaymentId, input: MarkPaidInput): Promise<PaymentRecord>;
  pause(id: PaymentId, version: ExpectedPaymentVersion): Promise<PaymentRecord>;
  archive(
    id: PaymentId,
    version: ExpectedPaymentVersion,
  ): Promise<PaymentRecord>;
  restore(
    id: PaymentId,
    version: ExpectedPaymentVersion,
  ): Promise<PaymentRecord>;
  delete(id: PaymentId, version: ExpectedPaymentVersion): Promise<void>;
}

export interface SettingsService {
  get(): Promise<AppSettings>;
  update(changes: AppSettingsPatch): Promise<AppSettings>;
}

export interface BackupDownload {
  readonly filename: string;
  readonly mediaType: "application/json";
  readonly contents: string;
}

export interface ImportResult {
  readonly inserted: number;
  readonly updated: number;
  readonly removed: number;
  readonly total: number;
}

export interface BackupService {
  export(): Promise<BackupDownload>;
  preview(text: string): Promise<ImportPreview>;
  applyMerge(preview: ImportPreview): Promise<ImportResult>;
  applyReplacement(preview: ImportPreview): Promise<ImportResult>;
}

export interface ApplicationEnvironment {
  currentDate(): CalendarDate;
  now(): Date;
  createId(): PaymentId;
}

export interface ApplicationServices {
  readonly payments: PaymentService;
  readonly settings: SettingsService;
  readonly backup: BackupService;
  readonly environment: ApplicationEnvironment;
  close(): void;
}

export type ApplicationInitializer = () => Promise<ApplicationServices>;

export type {
  AppSettings,
  AppSettingsPatch,
  CalendarDate,
  ImportPreview,
  PaymentId,
  RecurringPayment,
};
