import { PageHeader } from "../components/PageHeader";

export function PaymentFormPage() {
  return (
    <div className="page page--form">
      <PageHeader
        index="03"
        eyebrow="New record"
        title="Add payment"
        copy="The full payment editor arrives when the domain package is connected."
        metadata={[
          { label: "Mode", value: "New entry" },
          { label: "Required", value: "Name / value / date" },
          { label: "State", value: "Not yet available" },
        ]}
      />

      <form className="payment-form">
        <fieldset disabled>
          <legend>Payment details</legend>
          <label>
            <span>Name</span>
            <input placeholder="e.g. Internet plan" />
          </label>
          <div className="field-row">
            <label>
              <span>Amount</span>
              <input inputMode="decimal" placeholder="0" />
            </label>
            <label>
              <span>Currency</span>
              <select defaultValue="INR">
                <option>INR</option>
              </select>
            </label>
          </div>
          <label>
            <span>Next due date</span>
            <input type="date" />
          </label>
          <button type="submit">Save payment</button>
        </fieldset>
      </form>
    </div>
  );
}
