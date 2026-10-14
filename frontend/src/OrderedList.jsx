// Items can be plain values ("Apples") or objects ({ id: 1, label: "Apples" }).
export default function OrderedList({
  items = [],
  title,
  start = 1,
  reversed = false,
  type = "1",            // "1" numbers, "a" / "A" letters, "i" / "I" roman numerals
  emptyMessage = "No items to display.",
  renderItem,            // optional: (item) => JSX, for custom item content
  className = "",
}) {
  const normalized = items.map((item, index) =>
    typeof item === "object" && item !== null
      ? { id: item.id ?? index, label: item.label, raw: item }
      : { id: index, label: item, raw: item }
  );

  return (
    <div className={className}>
      {title && <h3>{title}</h3>}

      {normalized.length === 0 ? (
        <p>{emptyMessage}</p>
      ) : (
        <ol start={start} reversed={reversed} type={type}>
          {normalized.map((item) => (
            <li key={item.id}>
              {renderItem ? renderItem(item.raw) : item.label}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
