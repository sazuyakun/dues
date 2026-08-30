// These exports keep the Phase 1 screens isolated behind route-level names.
// Gate 3 replaces them with each feature directory's public index.ts export.
export { BackupPage as BackupRoute } from "../pages/BackupPage";
export { PaymentFormPage as PaymentFormRoute } from "../pages/PaymentFormPage";
export { PaymentsPage as PaymentsRoute } from "../pages/PaymentsPage";
export { UpcomingPage as UpcomingRoute } from "../pages/UpcomingPage";
