import { useEffect, useId, useRef, type ReactNode } from "react";

interface ConfirmDialogProps {
  readonly title: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly destructive?: boolean;
  readonly children: ReactNode;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ConfirmDialog({
  title,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  children,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const cancelButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    cancelButton.current?.focus();
    return () => {
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, []);

  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onCancel();
          return;
        }
        if (event.key !== "Tab") return;
        const controls = dialog.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])",
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <section
        ref={dialog}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <p className="eyebrow">Confirmation required</p>
        <h2 id={titleId}>{title}</h2>
        <div id={descriptionId}>{children}</div>
        <div className="dialog-actions">
          <button ref={cancelButton} type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={destructive ? "destructive-action" : undefined}
            type="button"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
