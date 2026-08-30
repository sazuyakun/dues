import type { PaymentRecord } from "../data/sample-payments";

interface PaymentRowProps {
  payment: PaymentRecord;
  index: number;
}

export function PaymentRow({ payment, index }: PaymentRowProps) {
  return (
    <article className="payment-row">
      <span className="payment-index" aria-hidden="true">
        {String(index).padStart(3, "0")}
      </span>
      <div className="payment-copy">
        <h3>{payment.name}</h3>
        <p>
          {payment.due} <span aria-hidden="true">·</span> {payment.frequency}
        </p>
      </div>
      <strong className="payment-amount">
        <span className="sr-only">Amount: </span>
        {payment.amount}
      </strong>
    </article>
  );
}
