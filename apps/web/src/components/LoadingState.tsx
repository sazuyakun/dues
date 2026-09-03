interface LoadingStateProps {
  readonly title: string;
  readonly message?: string;
}

export function LoadingState({ title, message }: LoadingStateProps) {
  return (
    <section className="loading-state" role="status" aria-live="polite">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
      <span className="loading-track" aria-hidden="true">
        <span />
      </span>
    </section>
  );
}
