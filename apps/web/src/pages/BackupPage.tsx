import { PageHeader } from "../components/PageHeader";

export function BackupPage() {
  return (
    <div className="page page--backup">
      <PageHeader
        index="04"
        eyebrow="Your data"
        title="Backup"
        copy="Portable export and carefully previewed import will live here."
        metadata={[
          { label: "Format", value: "Versioned JSON" },
          { label: "Transfer", value: "Manual" },
          { label: "Overwrite", value: "Never silent" },
        ]}
      />

      <section className="backup-plate">
        <div className="backup-object" aria-hidden="true">
          <span>{"{"}</span>
          <strong>JSON</strong>
          <span>{"}"}</span>
        </div>
        <div className="backup-copy">
          <p className="eyebrow">Portable by design</p>
          <h2>Stay in control</h2>
          <p>
            Backups will be plain, versioned JSON files. They will never
            silently overwrite your existing records.
          </p>
          <button disabled type="button">
            Export backup
          </button>
        </div>
      </section>
    </div>
  );
}
