import { Link } from "react-router-dom";
import type { PaymentRecord } from "../../app/index";
import { formatMinorUnitAmount, recurrenceLabel } from "./upcomingModel";

interface UpcomingPaymentRowProps {
  readonly index: number;
  readonly payment: PaymentRecord;
  readonly reminder: boolean;
  readonly pending: boolean;
  readonly onMarkPaid: (payment: PaymentRecord) => void;
}

export function UpcomingPaymentRow({
  index,
  payment,
  reminder,
  pending,
  onMarkPaid,
}: UpcomingPaymentRowProps) {
  return (
    <article className="upcoming-payment-row">
      <span className="upcoming-payment-index" aria-hidden="true">
        {String(index).padStart(3, "0")}
      </span>
      <div className="upcoming-payment-copy">
        <h3>{payment.name}</h3>
        <p>
          Due {payment.nextDueDate} <span aria-hidden="true">·</span>{" "}
          {recurrenceLabel(payment)}
        </p>
        {reminder && (
          <p className="upcoming-reminder-badge">
            Reminder window · {payment.reminderLeadDays} day
            {payment.reminderLeadDays === 1 ? "" : "s"}
          </p>
        )}
      </div>
      <strong className="upcoming-payment-amount">
        <span className="sr-only">Amount: </span>
        {formatMinorUnitAmount(payment.amount, payment.currency)}
      </strong>
      <div className="upcoming-payment-actions">
        <Link to={`/payments/${encodeURIComponent(payment.id)}/edit`}>
          Edit
        </Link>
        <button
          type="button"
          disabled={pending}
          aria-label={`Mark ${payment.name} paid`}
          onClick={() => onMarkPaid(payment)}
        >
          {pending ? "Marking…" : "Mark paid"}
        </button>
      </div>
    </article>
  );
}
