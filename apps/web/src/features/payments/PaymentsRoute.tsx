import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  filterPayments,
  isSafeProviderUrl,
  type PaymentStatus,
} from "@dues/core";

import {
  presentApplicationError,
  toApplicationError,
  useApplicationServices,
  type ApplicationError,
  type PaymentRecord,
} from "../../app/index";
import {
  ConfirmDialog,
  EmptyState,
  LoadingState,
  PageHeader,
  SectionHeading,
  StatusMessage,
} from "../../components";
import { formatMinorUnitAmount } from "./amount";
import "./payments.css";

interface PaymentsRouteProps {
  readonly locale?: string;
}

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready" }
  | { readonly status: "error"; readonly error: ApplicationError };

type PaymentAction = "pause" | "archive" | "restore" | "delete";

interface PendingAction {
  readonly paymentId: string;
  readonly action: PaymentAction;
}

interface Notice {
  readonly tone: "success" | "error";
  readonly title: string;
  readonly message?: string;
}

const routeNotice = (state: unknown): Notice | undefined => {
  if (
    typeof state === "object" &&
    state !== null &&
    "paymentNotice" in state &&
    typeof state.paymentNotice === "string"
  ) {
    return {
      tone: "success",
      title: state.paymentNotice,
    };
  }
  return undefined;
};

const successMessage = (
  action: PaymentAction,
  payment: PaymentRecord,
): string => {
  switch (action) {
    case "pause":
      return `${payment.name} is paused.`;
    case "archive":
      return `${payment.name} moved to the archive.`;
    case "restore":
      return `${payment.name} is active again.`;
    case "delete":
      return `${payment.name} was permanently deleted.`;
  }
};

export function PaymentsRoute({
  locale = navigator.language || "en",
}: PaymentsRouteProps) {
  const { payments } = useApplicationServices();
  const location = useLocation();
  const [records, setRecords] = useState<readonly PaymentRecord[]>([]);
  const [loadState, setLoadState] = useState<LoadState>({
    status: "loading",
  });
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [pending, setPending] = useState<PendingAction>();
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord>();
  const [notice, setNotice] = useState<Notice | undefined>(() =>
    routeNotice(location.state),
  );

  const loadRecords = useCallback(
    async (showLoading = true): Promise<void> => {
      await Promise.resolve();
      if (showLoading) setLoadState({ status: "loading" });
      try {
        setRecords(await payments.list());
        setLoadState({ status: "ready" });
      } catch (error) {
        setLoadState({ status: "error", error: toApplicationError(error) });
      }
    },
    [payments],
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) void loadRecords();
    });
    return () => {
      active = false;
    };
  }, [loadRecords]);

  const categories = useMemo(
    () =>
      [...new Set(records.flatMap((payment) => payment.category ?? []))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [records],
  );

  const visibleRecords = useMemo(() => {
    const matches = filterPayments(records, {
      query,
      ...(category === "all" ? {} : { categories: [category] }),
      ...(status === "all" ? {} : { statuses: [status] }),
    });
    const matchingIds = new Set(matches.map(({ id }) => id));
    return records.filter(({ id }) => matchingIds.has(id));
  }, [category, query, records, status]);

  const runAction = async (
    payment: PaymentRecord,
    action: PaymentAction,
  ): Promise<void> => {
    setPending({ paymentId: payment.id, action });
    setNotice(undefined);
    const version = { expectedUpdatedAt: payment.updatedAt };

    try {
      if (action === "delete") {
        await payments.delete(payment.id, version);
        setRecords((current) => current.filter(({ id }) => id !== payment.id));
      } else {
        const updated = await payments[action](payment.id, version);
        setRecords((current) =>
          current.map((record) =>
            record.id === updated.id ? updated : record,
          ),
        );
      }
      setNotice({
        tone: "success",
        title: successMessage(action, payment),
      });
    } catch (error) {
      const applicationError = toApplicationError(error);
      const presentation = presentApplicationError(applicationError);
      if (applicationError.code === "conflict") {
        await loadRecords(false);
      }
      setNotice({
        tone: "error",
        title: presentation.title,
        message:
          applicationError.code === "conflict"
            ? `${presentation.message} The list was reloaded.`
            : presentation.message,
      });
    } finally {
      setPending(undefined);
    }
  };

  if (loadState.status === "loading") {
    return (
      <div className="page payments-feature">
        <LoadingState
          title="Opening the payment register"
          message="Reading recurring payments stored on this device."
        />
      </div>
    );
  }

  if (loadState.status === "error") {
    const presentation = presentApplicationError(loadState.error);
    return (
      <div className="page payments-feature">
        <StatusMessage tone="error" title={presentation.title}>
          <p>{presentation.message}</p>
          {presentation.retryable && (
            <button type="button" onClick={() => void loadRecords()}>
              Try again
            </button>
          )}
        </StatusMessage>
      </div>
    );
  }

  return (
    <div className="page payments-feature">
      <PageHeader
        index="02"
        eyebrow="Payment register"
        title="Payments"
        copy="Search the local record, distinguish paused and archived entries, and make deliberate state changes."
        metadata={[
          { label: "Records", value: String(records.length).padStart(2, "0") },
          {
            label: "Visible",
            value: String(visibleRecords.length).padStart(2, "0"),
          },
          { label: "Order", value: "Due date" },
        ]}
      />

      {notice && (
        <section
          className="payment-inline-alert payment-inline-alert--compact"
          data-tone={notice.tone}
          role={notice.tone === "error" ? "alert" : "status"}
        >
          <strong>{notice.title}</strong>
          {notice.message && <p>{notice.message}</p>}
        </section>
      )}

      {records.length === 0 ? (
        <EmptyState
          title="No payments recorded"
          message="Add the first recurring due to begin your private register."
          action={<Link to="/add">Add your first payment</Link>}
        />
      ) : (
        <>
          <section
            className="payment-filter-register"
            aria-label="Payment filters"
          >
            <label className="payment-search">
              <span>Search register</span>
              <input
                type="search"
                value={query}
                placeholder="Name, category, method, or notes"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              <span>Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as PaymentStatus | "all")
                }
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </label>
            <button
              className="secondary-action"
              type="button"
              disabled={query === "" && category === "all" && status === "all"}
              onClick={() => {
                setQuery("");
                setCategory("all");
                setStatus("all");
              }}
            >
              Clear filters
            </button>
          </section>

          <section
            className="payment-register"
            aria-labelledby="payment-register-title"
          >
            <SectionHeading
              id="payment-register-title"
              eyebrow="Local entries"
              title="Recurring payments"
              count={visibleRecords.length}
            />

            {visibleRecords.length === 0 ? (
              <div className="payment-no-results">
                <p className="telemetry">No matches</p>
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setCategory("all");
                    setStatus("all");
                  }}
                >
                  Show all payments
                </button>
              </div>
            ) : (
              <ol className="payment-manifest">
                {visibleRecords.map((payment, index) => {
                  const rowPending = pending?.paymentId === payment.id;
                  const providerUrl =
                    payment.providerUrl &&
                    isSafeProviderUrl(payment.providerUrl)
                      ? payment.providerUrl
                      : undefined;
                  return (
                    <li
                      key={payment.id}
                      className="payment-manifest-row"
                      data-status={payment.status}
                      aria-busy={rowPending || undefined}
                    >
                      <span className="payment-sequence" aria-hidden="true">
                        {String(index + 1).padStart(3, "0")}
                      </span>
                      <div className="payment-manifest-copy">
                        <div className="payment-title-line">
                          <h3>{payment.name}</h3>
                          <span className="payment-status-marker">
                            {payment.status}
                          </span>
                        </div>
                        <p>
                          <time dateTime={payment.nextDueDate}>
                            Due {payment.nextDueDate}
                          </time>
                          {payment.category && (
                            <>
                              <span aria-hidden="true"> · </span>
                              {payment.category}
                            </>
                          )}
                        </p>
                        {payment.paymentMethodLabel && (
                          <p>Method: {payment.paymentMethodLabel}</p>
                        )}
                      </div>
                      <strong className="payment-manifest-amount">
                        {formatMinorUnitAmount(
                          payment.amount,
                          payment.currency,
                          locale,
                        )}
                      </strong>
                      <div className="payment-row-actions">
                        {payment.status !== "archived" && (
                          <Link to={`/payments/${payment.id}/edit`}>Edit</Link>
                        )}
                        {providerUrl && (
                          <a
                            href={providerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Manage at provider
                          </a>
                        )}
                        {payment.status === "active" && (
                          <button
                            type="button"
                            disabled={pending !== undefined}
                            onClick={() => void runAction(payment, "pause")}
                          >
                            {rowPending && pending?.action === "pause"
                              ? "Pausing…"
                              : "Pause"}
                          </button>
                        )}
                        {payment.status === "paused" && (
                          <button
                            type="button"
                            disabled={pending !== undefined}
                            onClick={() => void runAction(payment, "restore")}
                          >
                            {rowPending && pending?.action === "restore"
                              ? "Resuming…"
                              : "Resume"}
                          </button>
                        )}
                        {payment.status !== "archived" && (
                          <button
                            type="button"
                            disabled={pending !== undefined}
                            onClick={() => void runAction(payment, "archive")}
                          >
                            {rowPending && pending?.action === "archive"
                              ? "Archiving…"
                              : "Archive"}
                          </button>
                        )}
                        {payment.status === "archived" && (
                          <button
                            type="button"
                            disabled={pending !== undefined}
                            onClick={() => void runAction(payment, "restore")}
                          >
                            {rowPending && pending?.action === "restore"
                              ? "Restoring…"
                              : "Restore"}
                          </button>
                        )}
                        <button
                          className="destructive-text-action"
                          type="button"
                          disabled={pending !== undefined}
                          onClick={() => setDeleteTarget(payment)}
                        >
                          Delete permanently
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={`Permanently delete ${deleteTarget.name}?`}
          confirmLabel="Delete permanently"
          destructive
          onCancel={() => setDeleteTarget(undefined)}
          onConfirm={() => {
            const payment = deleteTarget;
            setDeleteTarget(undefined);
            void runAction(payment, "delete");
          }}
        >
          This cannot be undone.
        </ConfirmDialog>
      )}
    </div>
  );
}
