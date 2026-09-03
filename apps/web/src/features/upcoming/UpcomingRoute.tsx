import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ApplicationError,
  presentApplicationError,
  toApplicationError,
  useApplicationServices,
  type PaymentRecord,
} from "../../app/index";
import {
  EmptyState,
  LoadingState,
  PageHeader,
  SectionHeading,
  StatusMessage,
} from "../../components/index";
import {
  createUpcomingViewModel,
  UPCOMING_SECTIONS,
  type UpcomingViewModel,
} from "./upcomingModel";
import { UpcomingPaymentRow } from "./UpcomingPaymentRow";
import { UpcomingTotals } from "./UpcomingTotals";
import "./upcoming.css";

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly records: readonly PaymentRecord[] }
  | { readonly status: "error"; readonly error: ApplicationError };

type ModelState =
  | { readonly ok: true; readonly value: UpcomingViewModel }
  | { readonly ok: false; readonly error: ApplicationError };

export function UpcomingRoute() {
  const { payments, environment } = useApplicationServices();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const pendingIdsRef = useRef(new Set<string>());
  const mountedRef = useRef(true);
  const [actionError, setActionError] = useState<ApplicationError>();
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void payments.list().then(
      (records) => {
        if (active) setLoadState({ status: "ready", records });
      },
      (error: unknown) => {
        if (active) {
          setLoadState({ status: "error", error: toApplicationError(error) });
        }
      },
    );
    return () => {
      active = false;
    };
  }, [loadAttempt, payments]);

  const today = environment.currentDate();
  const modelState = useMemo<ModelState | undefined>(() => {
    if (loadState.status !== "ready") return undefined;
    try {
      return {
        ok: true,
        value: createUpcomingViewModel(loadState.records, today),
      };
    } catch (error) {
      return { ok: false, error: toApplicationError(error) };
    }
  }, [loadState, today]);

  const retry = useCallback(() => {
    setActionError(undefined);
    setLoadState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const markPaid = useCallback(
    async (payment: PaymentRecord) => {
      if (pendingIdsRef.current.has(payment.id)) return;
      pendingIdsRef.current.add(payment.id);
      setPendingIds(new Set(pendingIdsRef.current));
      setActionError(undefined);
      setAnnouncement("");

      try {
        const updated = await payments.markPaid(payment.id, {
          expectedUpdatedAt: payment.updatedAt,
          paidThrough: today,
        });
        if (!mountedRef.current) return;
        setLoadState((current) =>
          current.status === "ready"
            ? {
                status: "ready",
                records: current.records.map((record) =>
                  record.id === updated.id ? updated : record,
                ),
              }
            : current,
        );
        setAnnouncement(
          `${payment.name} was marked paid. Next due ${updated.nextDueDate}.`,
        );
      } catch (error) {
        const applicationError = toApplicationError(error);
        if (applicationError.code === "conflict") {
          try {
            const latest = await payments.list();
            if (mountedRef.current) {
              setLoadState({ status: "ready", records: latest });
            }
          } catch (reloadError) {
            if (mountedRef.current) {
              setLoadState({
                status: "error",
                error: toApplicationError(reloadError),
              });
            }
          }
        }
        if (mountedRef.current) setActionError(applicationError);
      } finally {
        pendingIdsRef.current.delete(payment.id);
        if (mountedRef.current) {
          setPendingIds(new Set(pendingIdsRef.current));
        }
      }
    },
    [payments, today],
  );

  if (loadState.status === "loading") {
    return (
      <LoadingState
        title="Loading upcoming payments"
        message="Reading recurring payments from this device."
      />
    );
  }

  if (loadState.status === "error") {
    const presentation = presentApplicationError(loadState.error);
    return (
      <StatusMessage tone="error" title={presentation.title}>
        <p>{presentation.message}</p>
        {presentation.retryable && (
          <button type="button" onClick={retry}>
            Try again
          </button>
        )}
      </StatusMessage>
    );
  }

  if (modelState?.ok === false) {
    const presentation = presentApplicationError(modelState.error);
    return (
      <StatusMessage tone="error" title={presentation.title}>
        <p>{presentation.message}</p>
        {presentation.retryable && (
          <button type="button" onClick={retry}>
            Try again
          </button>
        )}
      </StatusMessage>
    );
  }

  if (modelState === undefined) return null;
  const model = modelState.value;

  return (
    <div className="page page--upcoming upcoming-dashboard">
      <PageHeader
        index="01"
        eyebrow="Upcoming overview"
        title="Know what's due."
        copy="Review active renewals, currency-separated commitments, and reminders stored on this device."
        metadata={[
          { label: "As of", value: today },
          {
            label: "Active",
            value: String(model.activeCount).padStart(2, "0"),
          },
          { label: "Storage", value: "This device" },
        ]}
      />

      {actionError && (
        <StatusMessage
          tone="error"
          title={presentApplicationError(actionError).title}
        >
          <p>{presentApplicationError(actionError).message}</p>
        </StatusMessage>
      )}
      {announcement && (
        <StatusMessage tone="success" title="Payment marked paid">
          <p>{announcement}</p>
        </StatusMessage>
      )}

      {loadState.records.length === 0 ? (
        <EmptyState
          title="No payments yet"
          message="Add a recurring payment to see its next due date and totals here."
          action={<Link to="/add">Add your first payment</Link>}
        />
      ) : model.upcomingCount === 0 ? (
        <EmptyState
          title="No upcoming payments"
          message="Paused and archived records stay out of the upcoming timeline and totals."
          action={<Link to="/payments">Review all payments</Link>}
        />
      ) : (
        <>
          <UpcomingTotals totals={model.totals} />

          <aside
            className="upcoming-reminder-note"
            aria-labelledby="reminder-note-title"
          >
            <p className="eyebrow">Reminder scope</p>
            <h2 id="reminder-note-title">In-app reminders</h2>
            <p>
              Reminder flags appear while Dues is open. Dues cannot guarantee
              reminders while the application is closed.
            </p>
          </aside>

          {UPCOMING_SECTIONS.map(({ key, eyebrow, title }) => {
            const records = model.groups[key];
            if (records.length === 0) return null;
            return (
              <section
                className={`upcoming-section upcoming-section--${key}`}
                aria-labelledby={`upcoming-${key}`}
                key={key}
              >
                <SectionHeading
                  id={`upcoming-${key}`}
                  eyebrow={eyebrow}
                  title={title}
                  count={records.length}
                />
                <div className="upcoming-payment-list">
                  {records.map((payment, index) => (
                    <UpcomingPaymentRow
                      key={payment.id}
                      index={index + 1}
                      payment={payment}
                      reminder={model.reminderIds.has(payment.id)}
                      pending={pendingIds.has(payment.id)}
                      onMarkPaid={markPaid}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
