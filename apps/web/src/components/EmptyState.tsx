import type { ReactNode } from "react";

interface EmptyStateProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly message: string;
  readonly action?: ReactNode;
}

export function EmptyState({
  eyebrow = "Register status",
  title,
  message,
  action,
}: EmptyStateProps) {
  return (
    <section className="empty-state">
      <p className="eyebrow">{eyebrow}</p>
      <div className="empty-state-copy">
        <h2>{title}</h2>
        <p>{message}</p>
        {action && <div className="empty-state-action">{action}</div>}
      </div>
    </section>
  );
}
