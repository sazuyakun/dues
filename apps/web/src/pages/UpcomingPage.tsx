import { PageHeader } from "../components/PageHeader";
import { PaymentRow } from "../components/PaymentRow";
import { SectionHeading } from "../components/SectionHeading";
import { samplePayments } from "../data/sample-payments";

export function UpcomingPage() {
  return (
    <div className="page page--upcoming">
      <PageHeader
        index="01"
        eyebrow="Upcoming overview"
        title="Know what's due."
        copy="A calm look at the recurring payments ahead."
        metadata={[
          { label: "Window", value: "Next 30 days" },
          { label: "Entries", value: "03 active" },
          { label: "Storage", value: "This device" },
        ]}
      />

      <section className="due-brief" aria-label="Spending summary">
        <div className="due-total">
          <p className="telemetry">Due this month / INR</p>
          <strong>
            <span>₹</span>318
          </strong>
          <p>2 payments remaining</p>
        </div>
        <div className="next-due">
          <p className="telemetry">Next entry</p>
          <h2>Tomorrow</h2>
          <p>Cloud storage / ₹199</p>
          <div className="due-trace" aria-hidden="true">
            {Array.from({ length: 7 }, (_, index) => (
              <span
                key={index}
                className={index === 0 || index === 3 ? "is-due" : undefined}
              />
            ))}
          </div>
          <small>7 day payment window</small>
        </div>
      </section>

      <section className="payment-section" aria-labelledby="next-seven-days">
        <SectionHeading
          id="next-seven-days"
          eyebrow="Coming up"
          title="Next seven days"
          count={2}
        />
        <div className="payment-list">
          {samplePayments.slice(0, 2).map((payment, index) => (
            <PaymentRow key={payment.id} payment={payment} index={index + 1} />
          ))}
        </div>
      </section>

      <section
        className="payment-section muted-section"
        aria-labelledby="beyond-this-week"
      >
        <SectionHeading
          id="beyond-this-week"
          eyebrow="Later"
          title="Beyond this week"
          count={1}
        />
        <div className="payment-list">
          <PaymentRow payment={samplePayments[2]} index={3} />
        </div>
      </section>
    </div>
  );
}
