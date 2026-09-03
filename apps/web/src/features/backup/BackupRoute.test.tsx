import {
  BACKUP_FORMAT,
  CURRENT_BACKUP_VERSION,
  MAX_BACKUP_BYTES,
  type BackupPayment,
  type ImportPreview,
} from "@dues/backup";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  ApplicationError,
  ApplicationProvider,
  ApplicationStartup,
  createTestApplicationServices,
  type BackupService,
  type ImportResult,
} from "../../app/index";
import { BackupRoute } from "./BackupRoute";
import type { BackupFileAccess } from "./fileAccess";

const payment = (
  id: string,
  name: string,
  currency = "USD",
): BackupPayment => ({
  id,
  name,
  amount: 1_299,
  currency,
  recurrence: { frequency: "monthly", anchorDay: 31 },
  nextDueDate: "2026-09-30",
  status: "active",
});

const validPreview = (
  overrides: Partial<ImportPreview> = {},
): ImportPreview => {
  const imported = payment("new-payment", "New payment");
  return {
    envelope: {
      format: BACKUP_FORMAT,
      version: CURRENT_BACKUP_VERSION,
      exportedAt: "2026-09-03T10:00:00.000Z",
    },
    validRecords: [imported],
    invalidRecords: [],
    newRecords: [imported],
    conflicts: [],
    ...overrides,
  };
};

interface RouteHarnessOptions {
  readonly preview?: ImportPreview;
  readonly exportError?: unknown;
  readonly previewError?: unknown;
  readonly mergeResult?: ImportResult;
  readonly replacementResult?: ImportResult;
  readonly applyError?: unknown;
  readonly readError?: unknown;
}

function renderRoute(options: RouteHarnessOptions = {}) {
  const preview = options.preview ?? validPreview();
  const download = {
    filename: "dues-backup-2026-09-03.json",
    mediaType: "application/json" as const,
    contents: '{"format":"dues-backup"}\n',
  };
  const exportBackup = vi.fn(async () => {
    if (options.exportError !== undefined) throw options.exportError;
    return download;
  });
  const previewBackup = vi.fn(async () => {
    if (options.previewError !== undefined) throw options.previewError;
    return preview;
  });
  const applyMerge = vi.fn(async () => {
    if (options.applyError !== undefined) throw options.applyError;
    return (
      options.mergeResult ?? {
        inserted: preview.newRecords.length,
        updated: 0,
        removed: 0,
        total: preview.validRecords.length,
      }
    );
  });
  const applyReplacement = vi.fn(async () => {
    if (options.applyError !== undefined) throw options.applyError;
    return (
      options.replacementResult ?? {
        inserted: preview.newRecords.length,
        updated: preview.conflicts.length,
        removed: 0,
        total: preview.validRecords.length,
      }
    );
  });
  const backup = {
    export: exportBackup,
    preview: previewBackup,
    applyMerge,
    applyReplacement,
  } satisfies BackupService;
  const readText = vi.fn(async () => {
    if (options.readError !== undefined) throw options.readError;
    return "backup contents";
  });
  const downloadFile = vi.fn();
  const fileAccess = {
    readText,
    download: downloadFile,
  } satisfies BackupFileAccess;
  const services = createTestApplicationServices({ backup });

  render(
    <ApplicationProvider initialize={async () => services}>
      <ApplicationStartup>
        <BackupRoute fileAccess={fileAccess} />
      </ApplicationStartup>
    </ApplicationProvider>,
  );

  return {
    preview,
    download,
    exportBackup,
    previewBackup,
    applyMerge,
    applyReplacement,
    readText,
    downloadFile,
  };
}

async function chooseBackup(file = new File(["{}"], "backup.json")) {
  const input = await screen.findByLabelText(/backup file/i);
  fireEvent.change(input, { target: { files: [file] } });
}

function expectCount(label: string, value: number) {
  const term = screen.getByText(label, { selector: "dt" });
  expect(term.nextElementSibling).toHaveTextContent(String(value));
}

describe("backup export", () => {
  it("warns that exports are unencrypted before downloading", async () => {
    const harness = renderRoute();
    await screen.findByRole("heading", { name: "Backup" });

    expect(screen.getByText(/not encrypted/i)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));

    await waitFor(() => expect(harness.exportBackup).toHaveBeenCalledOnce());
    expect(harness.downloadFile).toHaveBeenCalledWith(harness.download);
    expect(
      await screen.findByRole("heading", { name: "Backup downloaded" }),
    ).toBeVisible();
  });

  it("shows export failures without exposing internal details", async () => {
    const detail = "private database failure";
    const harness = renderRoute({ exportError: new Error(detail) });
    await screen.findByRole("heading", { name: "Backup", exact: true });

    fireEvent.click(screen.getByRole("button", { name: "Export backup" }));

    expect(
      await screen.findByRole("heading", { name: "Dues ran into a problem" }),
    ).toBeVisible();
    expect(harness.downloadFile).not.toHaveBeenCalled();
    expect(document.body).not.toHaveTextContent(detail);
  });
});

describe("backup file validation", () => {
  it("blocks oversized files before reading or previewing them", async () => {
    const harness = renderRoute();
    const oversized = new File(["{}"], "oversized.json");
    Object.defineProperty(oversized, "size", {
      value: MAX_BACKUP_BYTES + 1,
    });

    await chooseBackup(oversized);

    expect(
      await screen.findByRole("heading", { name: "Backup is too large" }),
    ).toBeVisible();
    expect(harness.readText).not.toHaveBeenCalled();
    expect(harness.previewBackup).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed JSON", "{not-json"],
    ["an unsupported version", '{"version":99}'],
  ])("shows a safe error for %s", async (_case, contents) => {
    const harness = renderRoute({
      previewError: new ApplicationError("invalid-data"),
    });
    harness.readText.mockResolvedValueOnce(contents);

    await chooseBackup();

    expect(
      await screen.findByRole("heading", {
        name: "This file cannot be imported",
      }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(contents);
    expect(harness.previewBackup).toHaveBeenCalledWith(contents);
  });

  it("does not expose file-reader errors", async () => {
    const secret = "private file-system detail";
    renderRoute({ readError: new Error(secret) });

    await chooseBackup();

    expect(
      await screen.findByRole("heading", { name: "Dues ran into a problem" }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(secret);
  });
});

describe("import preview", () => {
  it("shows valid, invalid, new, duplicate, and conflicting records", async () => {
    const fresh = payment("new", "Fresh record");
    const conflict = payment("existing", "Imported conflict", "INR");
    const preview = validPreview({
      validRecords: [fresh, conflict],
      newRecords: [fresh],
      conflicts: [conflict],
      invalidRecords: [
        {
          index: 2,
          errors: [
            {
              code: "duplicate_id",
              message: "Payment ID appears more than once in the backup",
              path: "id",
              recordIndex: 2,
            },
          ],
        },
        {
          index: 3,
          errors: [
            {
              code: "invalid_record",
              message: "Value has an invalid type",
              path: "amount",
              recordIndex: 3,
            },
          ],
        },
      ],
    });
    renderRoute({ preview });

    await chooseBackup(new File(["valid"], "recovery.json"));
    const panel = await screen.findByRole("region", { name: "Import preview" });

    expectCount("Valid", 2);
    expectCount("Invalid", 2);
    expectCount("New", 1);
    expectCount("Duplicates", 1);
    expectCount("Conflicts", 1);
    expect(within(panel).getAllByText("Fresh record")).toHaveLength(2);
    expect(within(panel).getAllByText("Imported conflict")).toHaveLength(2);
    expect(within(panel).getByText("Record 3")).toBeVisible();
    expect(within(panel).getByText("Record 4")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Import blocked" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Review merge" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Review replacement" }),
    ).toBeDisabled();
  });
});

describe("approved imports", () => {
  it("confirms and applies a merge, then invalidates the preview", async () => {
    const preview = validPreview({
      conflicts: [payment("existing", "Existing conflict")],
    });
    const harness = renderRoute({
      preview,
      mergeResult: { inserted: 1, updated: 0, removed: 0, total: 3 },
    });
    await chooseBackup();
    await screen.findByRole("heading", { name: "Import preview" });

    fireEvent.click(screen.getByRole("button", { name: "Review merge" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Merge this backup?",
    });
    expect(dialog).toHaveTextContent("Nothing will be deleted or overwritten");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Apply merge" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Merge complete" }),
    ).toBeVisible();
    expect(harness.applyMerge).toHaveBeenCalledWith(preview);
    expect(
      screen.queryByRole("heading", { name: "Import preview" }),
    ).not.toBeInTheDocument();
  });

  it("requires explicit replacement confirmation and supports cancellation", async () => {
    const preview = validPreview();
    const harness = renderRoute({
      preview,
      replacementResult: { inserted: 1, updated: 0, removed: 4, total: 1 },
    });
    await chooseBackup();
    await screen.findByRole("heading", { name: "Import preview" });

    fireEvent.click(screen.getByRole("button", { name: "Review replacement" }));
    const dialog = screen.getByRole("alertdialog", {
      name: "Replace the local register?",
    });
    expect(dialog).toHaveTextContent("either all of it succeeds or none");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(harness.applyReplacement).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Import preview" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Review replacement" }));
    fireEvent.click(
      within(
        screen.getByRole("alertdialog", {
          name: "Replace the local register?",
        }),
      ).getByRole("button", { name: "Replace register" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Replacement complete" }),
    ).toBeVisible();
    expect(harness.applyReplacement).toHaveBeenCalledWith(preview);
  });

  it("shows transaction failures safely and does not reuse the stale preview", async () => {
    const detail = "database transaction detail";
    const harness = renderRoute({
      applyError: new ApplicationError("operation-failed"),
    });
    await chooseBackup();
    await screen.findByRole("heading", { name: "Import preview" });
    fireEvent.click(screen.getByRole("button", { name: "Review replacement" }));
    fireEvent.click(screen.getByRole("button", { name: "Replace register" }));

    expect(
      await screen.findByRole("heading", {
        name: "The operation could not be completed",
      }),
    ).toBeVisible();
    expect(document.body).not.toHaveTextContent(detail);
    expect(harness.applyReplacement).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("heading", { name: "Import preview" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Review replacement" }),
    ).not.toBeInTheDocument();
  });
});
