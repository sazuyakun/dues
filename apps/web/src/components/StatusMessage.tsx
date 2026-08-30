import type { ReactNode } from "react";

interface StatusMessageProps {
  readonly title: string;
  readonly tone?: "info" | "success" | "error";
  readonly children?: ReactNode;
}

export function StatusMessage({
  title,
  tone = "info",
  children,
}: StatusMessageProps) {
  return (
    <section
      className="status-message"
      data-tone={tone}
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <h2>{title}</h2>
      {children}
    </section>
  );
}
