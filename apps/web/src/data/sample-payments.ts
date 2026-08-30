export interface PaymentRecord {
  id: string;
  name: string;
  due: string;
  frequency: string;
  amount: string;
}

export const samplePayments: readonly PaymentRecord[] = [
  {
    id: "cloud-storage",
    name: "Cloud storage",
    due: "Tomorrow",
    frequency: "Monthly",
    amount: "₹199",
  },
  {
    id: "music",
    name: "Music",
    due: "In 4 days",
    frequency: "Monthly",
    amount: "₹119",
  },
  {
    id: "domain-renewal",
    name: "Domain renewal",
    due: "Aug 26",
    frequency: "Yearly",
    amount: "$18",
  },
] as const;
