interface PageHeaderProps {
  index: string;
  eyebrow: string;
  title: string;
  copy: string;
  metadata: readonly { label: string; value: string }[];
}

export function PageHeader({
  index,
  eyebrow,
  title,
  copy,
  metadata,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-heading">
        <p className="eyebrow">
          <span aria-hidden="true">{index}</span>
          {eyebrow}
        </p>
        <h1>{title}</h1>
        <p className="lede">{copy}</p>
      </div>

      <dl className="page-metadata" aria-label="View details">
        {metadata.map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </header>
  );
}
