import type { CurrencyTotals } from "@dues/core";
import { formatMinorUnitAmount } from "./upcomingModel";

interface CurrencyTotalListProps {
  readonly label: string;
  readonly totals: CurrencyTotals;
}

function CurrencyTotalList({ label, totals }: CurrencyTotalListProps) {
  const entries = Object.entries(totals).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return (
    <section className="upcoming-total-card" aria-label={label}>
      <p className="telemetry">{label}</p>
      {entries.length === 0 ? (
        <p className="upcoming-total-empty">No active dues</p>
      ) : (
        <dl>
          {entries.map(([currency, amount]) => (
            <div key={currency}>
              <dt>{currency}</dt>
              <dd>{formatMinorUnitAmount(amount, currency)}</dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

interface UpcomingTotalsProps {
  readonly totals: {
    readonly month: CurrencyTotals;
    readonly year: CurrencyTotals;
  };
}

export function UpcomingTotals({ totals }: UpcomingTotalsProps) {
  return (
    <section
      className="upcoming-totals"
      aria-labelledby="upcoming-totals-title"
    >
      <header className="upcoming-block-heading">
        <p className="eyebrow">Committed spend</p>
        <h2 id="upcoming-totals-title">Totals by currency</h2>
        <p>Amounts are never converted or combined across currencies.</p>
      </header>
      <div className="upcoming-total-grid">
        <CurrencyTotalList label="Current month" totals={totals.month} />
        <CurrencyTotalList label="Current year" totals={totals.year} />
      </div>
    </section>
  );
}
