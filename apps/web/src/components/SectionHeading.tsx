interface SectionHeadingProps {
  id?: string;
  title: string;
  count?: number;
}

export function SectionHeading({ id, title, count }: SectionHeadingProps) {
  return (
    <header className="section-heading">
      <h2 id={id}>{title}</h2>
      {count !== undefined && (
        <span className="count" aria-label={`${count} payments`}>
          {String(count).padStart(2, "0")}
        </span>
      )}
    </header>
  );
}
