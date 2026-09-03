import {
  advancePaymentAfterPaid,
  applyPaymentChanges,
  isCalendarDate,
  validateRecurringPayment,
  type RecurringPayment,
} from "@dues/core";
import type { PaymentRepository, PaymentRecord } from "@dues/storage";
import {
  ApplicationError,
  type ApplicationEnvironment,
  type ExpectedPaymentVersion,
  type MarkPaidInput,
  type NewPaymentInput,
  type PaymentChanges,
  type PaymentId,
  type PaymentService,
} from "../app/index";
import { runServiceOperation } from "./errors";

function paymentValue(record: PaymentRecord): RecurringPayment {
  const { createdAt: _createdAt, updatedAt: _updatedAt, ...payment } = record;
  return validateRecurringPayment(payment);
}

function paymentChanges(
  payment: RecurringPayment,
): Omit<RecurringPayment, "id"> {
  const { id: _id, ...changes } = payment;
  return changes;
}

async function requirePayment(
  repository: PaymentRepository,
  id: PaymentId,
): Promise<PaymentRecord> {
  const record = await repository.get(id);
  if (record === undefined) throw new ApplicationError("not-found");
  return record;
}

function assertStatus(
  record: PaymentRecord,
  expected: RecurringPayment["status"],
): void {
  if (record.status !== expected) throw new ApplicationError("invalid-data");
}

export function createPaymentService(
  repository: PaymentRepository,
  environment: ApplicationEnvironment,
): PaymentService {
  return {
    list: () => runServiceOperation(() => repository.list()),
    get: (id) => runServiceOperation(() => repository.get(id)),
    create: (input: NewPaymentInput) =>
      runServiceOperation(() => {
        const payment = validateRecurringPayment({
          ...input,
          id: environment.createId(),
        });
        return repository.create(payment);
      }),
    update: (id, changes: PaymentChanges, version) =>
      runServiceOperation(async () => {
        const current = await requirePayment(repository, id);
        const updated = applyPaymentChanges(paymentValue(current), changes);
        return repository.update(id, paymentChanges(updated), version);
      }),
    markPaid: (id, input: MarkPaidInput) =>
      runServiceOperation(async () => {
        const current = await requirePayment(repository, id);
        assertStatus(current, "active");
        if (
          input.paidThrough !== undefined &&
          !isCalendarDate(input.paidThrough)
        ) {
          throw new ApplicationError("invalid-data");
        }
        const advanced = advancePaymentAfterPaid(
          paymentValue(current),
          input.paidThrough,
        );
        return repository.update(
          id,
          { nextDueDate: advanced.nextDueDate },
          input,
        );
      }),
    pause: (id, version: ExpectedPaymentVersion) =>
      runServiceOperation(async () => {
        const current = await requirePayment(repository, id);
        assertStatus(current, "active");
        return repository.update(id, { status: "paused" }, version);
      }),
    archive: (id, version: ExpectedPaymentVersion) =>
      runServiceOperation(async () => {
        const current = await requirePayment(repository, id);
        if (current.status === "archived") {
          throw new ApplicationError("invalid-data");
        }
        return repository.archive(id, version);
      }),
    restore: (id, version: ExpectedPaymentVersion) =>
      runServiceOperation(async () => {
        const current = await requirePayment(repository, id);
        if (current.status === "active") {
          throw new ApplicationError("invalid-data");
        }
        return repository.restore(id, version);
      }),
    delete: (id, version: ExpectedPaymentVersion) =>
      runServiceOperation(() => repository.delete(id, version)),
  };
}
