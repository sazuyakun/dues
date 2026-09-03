import type { ImportPreview } from "@dues/backup";
import { ConfirmDialog, StatusMessage } from "../../components";

export type ImportMode = "merge" | "replace";

interface RecordListProps {
  readonly title: string;
  readonly description: string;
  readonly records: ImportPreview["validRecords"];
}

function RecordList({ title, description, records }: RecordListProps) {
  return (
    <section className="backup-record-group">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
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
          <p className="eyebrow">Validated locally</p>
          <h2 id="backup-preview-heading">Import preview</h2>
          <p>
            <span>{filename}</span> · exported{" "}
            <time dateTime={preview.envelope.exportedAt}>
              {preview.envelope.exportedAt}
            </time>
          </p>
        </div>
        <span className="backup-version">
          Format v{preview.envelope.version}
        </span>
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
          <p>
            Every record must be valid and every ID unique before Dues can
            change local data.
          </p>
        </StatusMessage>
      )}

      <div className="backup-record-groups">
        <RecordList
          title="Valid records"
          description="Records whose complete portable fields passed validation."
          records={preview.validRecords}
        />
        <RecordList
          title="New records"
          description="Merge can add these without changing an existing payment."
          records={preview.newRecords}
        />
        <RecordList
          title="Conflicts"
          description="These IDs already exist locally. Merge preserves the local version."
          records={preview.conflicts}
        />
        <section className="backup-record-group">
          <div>
            <h3>Invalid and duplicate records</h3>
            <p>
              Only safe diagnostics and one-based record positions are shown.
            </p>
          </div>
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
          <p>
            Add only new records. Keep every existing local record and skip all
            conflicts.
          </p>
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
          <p>
            Make this backup the complete register. Existing records absent from
            it will be removed.
          </p>
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
          Add {preview.newRecords.length} new payment
          {preview.newRecords.length === 1 ? "" : "s"}, preserve every local
          record, and skip {preview.conflicts.length} conflict
          {preview.conflicts.length === 1 ? "" : "s"}. Nothing will be deleted
          or overwritten.
        </p>
      ) : (
        <p>
          Replace the local register with all {preview.validRecords.length}{" "}
          payment{preview.validRecords.length === 1 ? "" : "s"} in this backup.
          Matching IDs will be updated and local records absent from the backup
          will be removed. The change is atomic: either all of it succeeds or
          none of it is applied.
        </p>
      )}
    </ConfirmDialog>
  );
}
