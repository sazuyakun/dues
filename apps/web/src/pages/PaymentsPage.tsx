import { PageHeader } from "../components/PageHeader";
import { PaymentRow } from "../components/PaymentRow";
import { samplePayments } from "../data/sample-payments";

export function PaymentsPage() {
  return (
    <div className="page page--payments">
      <PageHeader
        index="02"
        eyebrow="Your records"
        title="Payments"
        copy="Search, filter, and maintain every recurring payment in one place."
        metadata={[
          { label: "Register", value: "All payments" },
          { label: "Entries", value: "03 active" },
          { label: "Order", value: "Next due" },
        ]}
      />

      <div className="toolbar" role="search">
        <label>
          <span>Find an entry</span>
          <input type="search" placeholder="Search payments" />
        </label>
        <button type="button">Filter records</button>
      </div>

      <section className="record-register" aria-label="All payments">
        <div className="register-heading" aria-hidden="true">
          <span>Index</span>
          <span>Payment / schedule</span>
          <span>Amount</span>
        </div>
        <div className="payment-list all-payments">
          {samplePayments.map((payment, index) => (
            <PaymentRow key={payment.id} payment={payment} index={index + 1} />
          ))}
        </div>
      </section>
    </div>
  );
}
