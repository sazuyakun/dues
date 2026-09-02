import {
  createBackup,
  createMergePlan,
  createReplacementPlan,
  fromBackupPayment,
  previewImport,
  serializeBackup,
  type BackupPayment,
  type ImportPreview,
} from "@dues/backup";
import { validateRecurringPayment } from "@dues/core";
import type {
  BulkMutation,
  PaymentRecord,
  PaymentRepository,
} from "@dues/storage";
import {
  ApplicationError,
  type ApplicationEnvironment,
  type BackupService,
  type ImportResult,
} from "../app/index";
import { runServiceOperation } from "./errors";

function nextImportTimestamp(
  environment: ApplicationEnvironment,
  existingRecords: readonly PaymentRecord[],
): string {
  let instant = environment.now().getTime();
  if (!Number.isFinite(instant)) throw new TypeError("Invalid current time");

  for (const record of existingRecords) {
    const previous = Date.parse(record.updatedAt);
    if (!Number.isFinite(previous)) throw new TypeError("Invalid stored time");
    instant = Math.max(instant, previous + 1);
  }
  return new Date(instant).toISOString();
}

function importRecord(
  payment: BackupPayment,
  timestamp: string,
): PaymentRecord {
  return {
    ...validateRecurringPayment(fromBackupPayment(payment)),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function invalidPlan(): never {
  throw new ApplicationError("invalid-data");
}

function paymentVersions(
  records: readonly PaymentRecord[],
): ReadonlyMap<string, string> {
  return new Map(records.map(({ id, updatedAt }) => [id, updatedAt]));
}

function assertFreshPreview(
  preview: ImportPreview,
  records: readonly PaymentRecord[],
  snapshots: WeakMap<ImportPreview, ReadonlyMap<string, string>>,
): void {
  const snapshot = snapshots.get(preview);
  if (snapshot === undefined || snapshot.size !== records.length) {
    throw new ApplicationError("conflict");
  }
  for (const record of records) {
    if (snapshot.get(record.id) !== record.updatedAt) {
      throw new ApplicationError("conflict");
    }
  }
}

export function createBackupService(
  repository: PaymentRepository,
  environment: ApplicationEnvironment,
): BackupService {
  const previewSnapshots = new WeakMap<
    ImportPreview,
    ReadonlyMap<string, string>
  >();

  return {
    export: () =>
      runServiceOperation(async () => {
        const records = await repository.list();
        const backup = createBackup(records, environment.now());
        return {
          filename: `dues-backup-${environment.currentDate()}.json`,
          mediaType: "application/json" as const,
          contents: serializeBackup(backup),
        };
      }),
    preview: (text) =>
      runServiceOperation(async () => {
        const existing = await repository.list();
        const preview = previewImport(
          text,
          new Set(existing.map(({ id }) => id)),
        );
        if (!preview.ok) invalidPlan();
        previewSnapshots.set(preview.value, paymentVersions(existing));
        return preview.value;
      }),
    applyMerge: (preview) =>
      runServiceOperation(async (): Promise<ImportResult> => {
        const plan = createMergePlan(preview);
        if (!plan.ready) invalidPlan();

        const existing = await repository.list();
        assertFreshPreview(preview, existing, previewSnapshots);
        const timestamp = nextImportTimestamp(environment, existing);
        const mutations: BulkMutation[] = plan.inserts.map((payment) => ({
          type: "create",
          payment: importRecord(payment, timestamp),
        }));
        await repository.applyBulk(mutations);
        return {
          inserted: mutations.length,
          updated: 0,
          removed: 0,
          total: existing.length + mutations.length,
        };
      }),
    applyReplacement: (preview) =>
      runServiceOperation(async (): Promise<ImportResult> => {
        const plan = createReplacementPlan(preview);
        if (!plan.ready) invalidPlan();

        const existing = await repository.list();
        assertFreshPreview(preview, existing, previewSnapshots);
        const existingById = new Map(
          existing.map((record) => [record.id, record]),
        );
        const importedIds = new Set(plan.records.map(({ id }) => id));
        const timestamp = nextImportTimestamp(environment, existing);
        const mutations: BulkMutation[] = plan.records.map((payment) => {
          const current = existingById.get(payment.id);
          const record = importRecord(payment, timestamp);
          return current === undefined
            ? { type: "create", payment: record }
            : {
                type: "update",
                payment: record,
                expectedUpdatedAt: current.updatedAt,
              };
        });

        for (const record of existing) {
          if (!importedIds.has(record.id)) {
            mutations.push({
              type: "delete",
              id: record.id,
              expectedUpdatedAt: record.updatedAt,
            });
          }
        }

        await repository.applyBulk(mutations);
        const updated = plan.records.filter(({ id }) =>
          existingById.has(id),
        ).length;
        return {
          inserted: plan.records.length - updated,
          updated,
          removed: existing.length - updated,
          total: plan.records.length,
        };
      }),
  };
}
