import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { validateRecurringPayment } from "@dues/core";

import {
  ApplicationProvider,
  ApplicationStartup,
  type ApplicationServices,
  type PaymentRecord,
} from "../../app/index";
import { PaymentFormRoute } from "./PaymentFormRoute";
import { PaymentsRoute } from "./PaymentsRoute";

export const paymentRecord = (
  overrides: Partial<PaymentRecord> = {},
): PaymentRecord => {
  const {
    createdAt = "2026-01-01T00:00:00.000Z",
    updatedAt = "2026-01-01T00:00:00.000Z",
    ...paymentOverrides
  } = overrides;
  return {
    ...validateRecurringPayment({
      id: "payment-1",
      name: "Workspace",
      amount: 1_299,
      currency: "USD",
      recurrence: { frequency: "monthly", anchorDay: 31 },
      nextDueDate: "2026-01-31",
      status: "active",
      ...paymentOverrides,
    }),
    createdAt,
    updatedAt,
  };
};

export const renderPaymentFeature = (
  services: ApplicationServices,
  initialEntry: string,
) => {
  const initialize = async (): Promise<ApplicationServices> => services;
  return render(
    <ApplicationProvider initialize={initialize}>
      <ApplicationStartup>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route
              path="/payments"
              element={<PaymentsRoute locale="en-US" />}
            />
            <Route path="/add" element={<PaymentFormRoute locale="en-US" />} />
            <Route
              path="/payments/:paymentId/edit"
              element={<PaymentFormRoute locale="en-US" />}
            />
          </Routes>
        </MemoryRouter>
      </ApplicationStartup>
    </ApplicationProvider>,
  );
};
