import { MAX_BACKUP_BYTES, type ImportPreview } from "@dues/backup";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ApplicationError,
  presentApplicationError,
  toApplicationError,
  useApplicationServices,
  type ImportResult,
} from "../../app/index";
import { PageHeader, StatusMessage } from "../../components";
import { browserBackupFileAccess, type BackupFileAccess } from "./fileAccess";
import {
  ImportConfirmation,
  ImportPreviewPanel,
  type ImportMode,
} from "./ImportPreviewPanel";
import "./backup.css";

type Operation = "export" | "preview" | "merge" | "replace";

interface Notice {
  readonly tone: "success" | "error";
  readonly title: string;
  readonly message: string;
}

interface BackupRouteProps {
  readonly fileAccess?: BackupFileAccess;
}

const formatLimit = (): string => `${MAX_BACKUP_BYTES / 1024 / 1024} MiB`;

const applicationNotice = (error: unknown): Notice => {
  const presentation = presentApplicationError(toApplicationError(error));
  return {
    tone: "error",
    title: presentation.title,
    message: presentation.message,
  };
};

const importNotice = (error: unknown): Notice => {
  if (error instanceof ApplicationError && error.code === "invalid-data") {
    return {
      tone: "error",
      title: "This file cannot be imported",
      message:
        "Choose a valid, supported Dues JSON backup. The selected file may be malformed, incomplete, or from an unsupported version.",
    };
  }
  return applicationNotice(error);
};

const resultNotice = (mode: ImportMode, result: ImportResult): Notice => ({
  tone: "success",
  title: mode === "merge" ? "Merge complete" : "Replacement complete",
  message: `Inserted ${result.inserted}, updated ${result.updated}, and removed ${result.removed}. Your local register now contains ${result.total} payment${result.total === 1 ? "" : "s"}.`,
});

export function BackupRoute({
  fileAccess = browserBackupFileAccess,
}: BackupRouteProps) {
  const { backup } = useApplicationServices();
  const fileInput = useRef<HTMLInputElement>(null);
  const [operation, setOperation] = useState<Operation>();
  const [preview, setPreview] = useState<ImportPreview>();
  const [filename, setFilename] = useState("");
  const [notice, setNotice] = useState<Notice>();
  const [confirmation, setConfirmation] = useState<ImportMode>();
  const busy = operation !== undefined;

  const clearFileSelection = () => {
    if (fileInput.current) fileInput.current.value = "";
    setFilename("");
  };

  const exportBackup = async () => {
    if (busy) return;
    setOperation("export");
    setNotice(undefined);
    try {
      const download = await backup.export();
      fileAccess.download(download);
      setNotice({
        tone: "success",
        title: "Backup downloaded",
        message: `${download.filename} contains your current portable payment records. Store this unencrypted file somewhere private.`,
      });
    } catch (error) {
      setNotice(applicationNotice(error));
    } finally {
      setOperation(undefined);
    }
  };

  const previewFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || busy) return;

    setPreview(undefined);
    setConfirmation(undefined);
    setNotice(undefined);
    setFilename(file.name);

    if (file.size > MAX_BACKUP_BYTES) {
      setNotice({
        tone: "error",
        title: "Backup is too large",
        message: `Choose a file no larger than ${formatLimit()}. Your local data has not been changed.`,
      });
      clearFileSelection();
      return;
    }

    setOperation("preview");
    try {
      const text = await fileAccess.readText(file);
      const nextPreview = await backup.preview(text);
      setPreview(nextPreview);
    } catch (error) {
      setNotice(importNotice(error));
      clearFileSelection();
    } finally {
      setOperation(undefined);
    }
  };

  const applyImport = async (mode: ImportMode) => {
    if (!preview || preview.invalidRecords.length > 0 || busy) return;

    const approvedPreview = preview;
    setConfirmation(undefined);
    setPreview(undefined);
    clearFileSelection();
    setNotice(undefined);
    setOperation(mode);

    try {
      const result =
        mode === "merge"
          ? await backup.applyMerge(approvedPreview)
          : await backup.applyReplacement(approvedPreview);
      setNotice(resultNotice(mode, result));
    } catch (error) {
      setNotice(applicationNotice(error));
    } finally {
      setOperation(undefined);
    }
  };

  return (
    <div className="page page--backup">
      <PageHeader
        index="04"
        eyebrow="Your data"
        title="Backup"
        copy="Export a portable copy or preview a recovery file before anything changes on this device."
        metadata={[
          { label: "Format", value: "Versioned JSON" },
          { label: "Storage", value: "Local only" },
          { label: "Encryption", value: "None" },
        ]}
      />

      <div className="backup-workflow">
        <section className="backup-panel" aria-labelledby="backup-export-title">
          <div className="backup-panel-index" aria-hidden="true">
            01
          </div>
          <div>
            <p className="eyebrow">Portable export</p>
            <h2 id="backup-export-title">Download your current register</h2>
            <p>
              The JSON file contains private financial metadata including
              payment names, amounts, dates, notes, and provider links.
            </p>
            <p className="backup-warning">
              This backup is plain text and is not encrypted. Anyone who can
              read the file can read its contents.
            </p>
            <button type="button" disabled={busy} onClick={exportBackup}>
              {operation === "export" ? "Preparing export…" : "Export backup"}
            </button>
          </div>
        </section>

        <section className="backup-panel" aria-labelledby="backup-import-title">
          <div className="backup-panel-index" aria-hidden="true">
            02
          </div>
          <div>
            <p className="eyebrow">Safe recovery</p>
            <h2 id="backup-import-title">Choose a backup to preview</h2>
            <p>
              Dues reads and validates the file locally. Selecting a file never
              changes your register; an approved merge or replacement is still
              required.
            </p>
            <label className="backup-file-field" htmlFor="backup-file">
              <span>Backup file</span>
              <input
                ref={fileInput}
                id="backup-file"
                type="file"
                accept=".json,application/json"
                disabled={busy}
                onChange={previewFile}
              />
              <small>UTF-8 JSON, up to {formatLimit()}</small>
            </label>
          </div>
        </section>

        {operation === "preview" && (
          <p className="backup-progress" role="status" aria-live="polite">
            Reading and validating the selected backup…
          </p>
        )}
        {(operation === "merge" || operation === "replace") && (
          <p className="backup-progress" role="status" aria-live="polite">
            Applying the approved {operation} atomically…
          </p>
        )}

        {notice && (
          <StatusMessage tone={notice.tone} title={notice.title}>
            <p>{notice.message}</p>
          </StatusMessage>
        )}

        {preview && (
          <ImportPreviewPanel
            preview={preview}
            filename={filename}
            busy={busy}
            onChooseMode={setConfirmation}
          />
        )}
      </div>

      {confirmation && preview && (
        <ImportConfirmation
          mode={confirmation}
          preview={preview}
          onCancel={() => setConfirmation(undefined)}
          onConfirm={() => void applyImport(confirmation)}
        />
      )}
    </div>
  );
}
