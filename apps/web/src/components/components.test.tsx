import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";
import { FormField } from "./FormField";
import { StatusMessage } from "./StatusMessage";

describe("shared application controls", () => {
  it("connects a field error to its input", () => {
    render(
      <FormField id="payment-name" label="Name" error="Enter a name">
        {(props) => <input {...props} />}
      </FormField>,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Enter a name");
  });

  it("announces failures assertively", () => {
    render(
      <StatusMessage tone="error" title="Could not save">
        Try again.
      </StatusMessage>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not saveTry again.",
    );
  });

  it("supports keyboard cancellation for confirmations", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Delete this payment?"
        confirmLabel="Delete payment"
        destructive
        onCancel={onCancel}
        onConfirm={vi.fn()}
      >
        This action cannot be undone.
      </ConfirmDialog>,
    );

    const dialog = screen.getByRole("alertdialog", {
      name: "Delete this payment?",
    });
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.keyDown(dialog.parentElement!, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
