import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <section className="empty-state">
      <p className="eyebrow">No entries</p>
      <h2>{title}</h2>
      <p>{message}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </section>
  );
}
