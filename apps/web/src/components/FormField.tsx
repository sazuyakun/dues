import type { ReactNode } from "react";

export interface FieldControlProps {
  readonly id: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid"?: true;
  readonly required?: true;
}

interface FormFieldProps {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly error?: string;
  readonly required?: boolean;
  readonly children: (controlProps: FieldControlProps) => ReactNode;
}

export function FormField({
  id,
  label,
  hint,
  error,
  required = false,
  children,
}: FormFieldProps) {
  const descriptionId = hint || error ? `${id}-description` : undefined;

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children({
        id,
        ...(descriptionId ? { "aria-describedby": descriptionId } : {}),
        ...(error ? { "aria-invalid": true } : {}),
        ...(required ? { required: true } : {}),
      })}
      {descriptionId && (
        <p className={error ? "field-error" : "field-hint"} id={descriptionId}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
