interface SectionHeadingProps {
  id?: string;
  eyebrow: string;
  title: string;
  count?: number;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  count,
}: SectionHeadingProps) {
  return (
    <header className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={id}>{title}</h2>
      </div>
      {count !== undefined && (
        <span className="count" aria-label={`${count} payments`}>
          {String(count).padStart(2, "0")}
        </span>
      )}
    </header>
  );
}
