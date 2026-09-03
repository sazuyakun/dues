import type { ImportPreview } from "@dues/backup";
import { ConfirmDialog, StatusMessage } from "../../components";

export type ImportMode = "merge" | "replace";

interface RecordListProps {
  readonly title: string;
  readonly records: ImportPreview["validRecords"];
}

function RecordList({ title, records }: RecordListProps) {
  return (
    <section className="backup-record-group">
      <h3>{title}</h3>
      {records.length === 0 ? (
        <p className="backup-record-empty">None</p>
      ) : (
        <ul>
          {records.map((record) => (
            <li key={record.id}>
              <span>{record.name}</span>
              <code>{record.id}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const duplicateCount = (preview: ImportPreview): number =>
  preview.invalidRecords.filter((record) =>
    record.errors.some(({ code }) => code === "duplicate_id"),
  ).length;

interface ImportPreviewPanelProps {
  readonly preview: ImportPreview;
  readonly filename: string;
  readonly busy: boolean;
  readonly onChooseMode: (mode: ImportMode) => void;
}

export function ImportPreviewPanel({
  preview,
  filename,
  busy,
  onChooseMode,
}: ImportPreviewPanelProps) {
  const blocked = preview.invalidRecords.length > 0;
  const duplicates = duplicateCount(preview);

  return (
    <section
      className="backup-preview"
      aria-labelledby="backup-preview-heading"
    >
      <div className="backup-preview-heading">
        <div>
          <h2 id="backup-preview-heading">Import preview</h2>
          <p>
            <span>{filename}</span> · exported{" "}
            <time dateTime={preview.envelope.exportedAt}>
              {preview.envelope.exportedAt}
            </time>
          </p>
        </div>
      </div>

      <dl className="backup-preview-counts" aria-label="Import record counts">
        <div>
          <dt>Valid</dt>
          <dd>{preview.validRecords.length}</dd>
        </div>
        <div>
          <dt>Invalid</dt>
          <dd>{preview.invalidRecords.length}</dd>
        </div>
        <div>
          <dt>New</dt>
          <dd>{preview.newRecords.length}</dd>
        </div>
        <div>
          <dt>Duplicates</dt>
          <dd>{duplicates}</dd>
        </div>
        <div>
          <dt>Conflicts</dt>
          <dd>{preview.conflicts.length}</dd>
        </div>
      </dl>

      {blocked && (
        <StatusMessage tone="error" title="Import blocked">
          <p>Fix invalid or duplicate records before importing.</p>
        </StatusMessage>
      )}

      <div className="backup-record-groups">
        <RecordList title="Valid records" records={preview.validRecords} />
        <RecordList title="New records" records={preview.newRecords} />
        <RecordList title="Conflicts" records={preview.conflicts} />
        <section className="backup-record-group">
          <h3>Invalid or duplicate records</h3>
          {preview.invalidRecords.length === 0 ? (
            <p className="backup-record-empty">None</p>
          ) : (
            <ul>
              {preview.invalidRecords.map((record) => (
                <li key={record.index}>
                  <span>Record {record.index + 1}</span>
                  <span>
                    {record.errors.map(({ code, message, path }, index) => (
                      <span key={`${code}-${path ?? "record"}-${index}`}>
                        {message}
                        {path ? ` (${path})` : ""}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="backup-import-actions">
        <section>
          <h3>Merge</h3>
          <p>Add new records and keep existing ones.</p>
          <button
            type="button"
            disabled={blocked || busy}
            onClick={() => onChooseMode("merge")}
          >
            Review merge
          </button>
        </section>
        <section>
          <h3>Replace</h3>
          <p>Use this backup as the complete register.</p>
          <button
            className="backup-replace-button"
            type="button"
            disabled={blocked || busy}
            onClick={() => onChooseMode("replace")}
          >
            Review replacement
          </button>
        </section>
      </div>
    </section>
  );
}

interface ImportConfirmationProps {
  readonly mode: ImportMode;
  readonly preview: ImportPreview;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export function ImportConfirmation({
  mode,
  preview,
  onCancel,
  onConfirm,
}: ImportConfirmationProps) {
  const merge = mode === "merge";

  return (
    <ConfirmDialog
      title={merge ? "Merge this backup?" : "Replace the local register?"}
      confirmLabel={merge ? "Apply merge" : "Replace register"}
      destructive={!merge}
      onCancel={onCancel}
      onConfirm={onConfirm}
    >
      {merge ? (
        <p>
          Add {preview.newRecords.length} payment
          {preview.newRecords.length === 1 ? "" : "s"} and skip{" "}
          {preview.conflicts.length} conflict
          {preview.conflicts.length === 1 ? "" : "s"}. Existing records will not
          change.
        </p>
      ) : (
        <p>
          Replace everything with {preview.validRecords.length} payment
          {preview.validRecords.length === 1 ? "" : "s"}. Records missing from
          this backup will be removed.
        </p>
      )}
    </ConfirmDialog>
  );
}
