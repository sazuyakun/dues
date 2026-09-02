import {
  BACKUP_FORMAT,
  CURRENT_BACKUP_VERSION,
  type ImportPreview,
} from "@dues/backup";
import {
  advancePaymentAfterPaid,
  applyPaymentChanges,
  validateNewPaymentInput,
  validateRecurringPayment,
  type RecurringPayment,
} from "@dues/core";
import type {
  AppSettings,
  ApplicationEnvironment,
  ApplicationServices,
  BackupService,
  CalendarDate,
  ExpectedPaymentVersion,
  ImportResult,
  MarkPaidInput,
  NewPaymentInput,
  PaymentChanges,
  PaymentId,
  PaymentRecord,
  PaymentService,
  SettingsService,
} from "./contracts";
import { ApplicationError } from "./errors";

const DEFAULT_SETTINGS: AppSettings = {
  onboardingComplete: false,
  defaultCurrency: "USD",
  theme: "system",
};

const EMPTY_RESULT: ImportResult = {
  inserted: 0,
  updated: 0,
  removed: 0,
  total: 0,
};

const paymentValue = (record: PaymentRecord): RecurringPayment => {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...payment } = record;
  return payment;
};

const validatedRecord = (record: PaymentRecord): PaymentRecord => ({
  ...validateRecurringPayment(paymentValue(record)),
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

const cloneRecord = (record: PaymentRecord): PaymentRecord =>
  structuredClone(record);

const invalidData = (): ApplicationError =>
  new ApplicationError("invalid-data");

function assertVersion(
  record: PaymentRecord,
  version: ExpectedPaymentVersion,
): void {
  if (record.updatedAt !== version.expectedUpdatedAt) {
    throw new ApplicationError("conflict");
  }
}

export interface DeterministicEnvironmentOptions {
  readonly currentDate?: CalendarDate;
  readonly instants?: readonly string[];
  readonly ids?: readonly PaymentId[];
}

export function createDeterministicEnvironment(
  options: DeterministicEnvironmentOptions = {},
): ApplicationEnvironment {
  const instants = [
    ...(options.instants?.length
      ? options.instants
      : ["2026-01-01T00:00:00.000Z"]),
  ];
  const ids = options.ids ? [...options.ids] : undefined;
  let instantIndex = 0;
  let idIndex = 0;
  let lastInstant = Number.NEGATIVE_INFINITY;

  return {
    currentDate: () => options.currentDate ?? "2026-01-01",
    now: () => {
      const value = instants[Math.min(instantIndex, instants.length - 1)];
      instantIndex += 1;
      const candidate = Date.parse(value);
      lastInstant = Math.max(candidate, lastInstant + 1);
      return new Date(lastInstant);
    },
    createId: () => {
      const value =
        ids?.[idIndex] ??
        (!ids ? (`test-payment-${idIndex + 1}` as PaymentId) : undefined);
      idIndex += 1;
      if (!value) throw new Error("No deterministic payment ID remains");
      return value;
    },
  };
}

export function createFakePaymentService(
  environment: ApplicationEnvironment,
  initialRecords: readonly PaymentRecord[] = [],
): PaymentService {
  const records = new Map(
    initialRecords.map((record) => {
      try {
        const validated = validatedRecord(record);
        return [validated.id, validated] as const;
      } catch {
        throw invalidData();
      }
    }),
  );

  const requireRecord = (id: PaymentId): PaymentRecord => {
    const record = records.get(id);
    if (!record) throw new ApplicationError("not-found");
    return record;
  };

  const persist = (
    current: PaymentRecord,
    changes: PaymentChanges,
    version: ExpectedPaymentVersion,
  ): PaymentRecord => {
    assertVersion(current, version);
    let payment: RecurringPayment;
    try {
      payment = applyPaymentChanges(paymentValue(current), changes);
    } catch {
      throw invalidData();
    }
    const updated: PaymentRecord = {
      ...payment,
      createdAt: current.createdAt,
      updatedAt: environment.now().toISOString(),
    };
    records.set(updated.id, updated);
    return cloneRecord(updated);
  };

  return {
    list: async () => [...records.values()].map(cloneRecord),
    get: async (id) => {
      const record = records.get(id);
      return record ? cloneRecord(record) : undefined;
    },
    create: async (input: NewPaymentInput) => {
      const id = environment.createId();
      if (records.has(id)) throw new ApplicationError("conflict");
      let payment: RecurringPayment;
      try {
        payment = validateRecurringPayment({
          ...validateNewPaymentInput(input),
          id,
        });
      } catch {
        throw invalidData();
      }
      const timestamp = environment.now().toISOString();
      const record: PaymentRecord = {
        ...payment,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      records.set(id, record);
      return cloneRecord(record);
    },
    update: async (id, changes, version) =>
      persist(requireRecord(id), changes, version),
    markPaid: async (id: PaymentId, input: MarkPaidInput) => {
      const current = requireRecord(id);
      assertVersion(current, input);
      const advanced = advancePaymentAfterPaid(
        paymentValue(current),
        input.paidThrough,
      );
      return persist(current, { nextDueDate: advanced.nextDueDate }, input);
    },
    pause: async (id, version) =>
      persist(requireRecord(id), { status: "paused" }, version),
    archive: async (id, version) =>
      persist(requireRecord(id), { status: "archived" }, version),
    restore: async (id, version) =>
      persist(requireRecord(id), { status: "active" }, version),
    delete: async (id, version) => {
      const current = requireRecord(id);
      assertVersion(current, version);
      records.delete(id);
    },
  };
}

export function createFakeSettingsService(
  initialSettings: AppSettings = DEFAULT_SETTINGS,
): SettingsService {
  let settings = { ...initialSettings };
  return {
    get: async () => ({ ...settings }),
    update: async (changes) => {
      settings = { ...settings, ...changes };
      return { ...settings };
    },
  };
}

export interface FakeBackupServiceOptions {
  readonly preview?: ImportPreview;
  readonly result?: ImportResult;
}

export function createFakeBackupService(
  options: FakeBackupServiceOptions = {},
): BackupService {
  const preview = options.preview ?? {
    envelope: {
      format: BACKUP_FORMAT,
      version: CURRENT_BACKUP_VERSION,
      exportedAt: "2026-01-01T00:00:00.000Z",
    },
    validRecords: [],
    invalidRecords: [],
    newRecords: [],
    conflicts: [],
  };
  const result = options.result ?? EMPTY_RESULT;

  return {
    export: async () => ({
      filename: "dues-backup-2026-01-01.json",
      mediaType: "application/json",
      contents: "{}\n",
    }),
    preview: async () => preview,
    applyMerge: async () => result,
    applyReplacement: async () => result,
  };
}

export interface TestApplicationServicesOptions {
  readonly environment?: ApplicationEnvironment;
  readonly payments?: PaymentService;
  readonly settings?: SettingsService;
  readonly backup?: BackupService;
  readonly initialPayments?: readonly PaymentRecord[];
}

export function createTestApplicationServices(
  options: TestApplicationServicesOptions = {},
): ApplicationServices {
  const environment = options.environment ?? createDeterministicEnvironment();
  return {
    environment,
    payments:
      options.payments ??
      createFakePaymentService(environment, options.initialPayments),
    settings: options.settings ?? createFakeSettingsService(),
    backup: options.backup ?? createFakeBackupService(),
    close: () => undefined,
  };
}
