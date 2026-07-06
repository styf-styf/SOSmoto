function getPageItems(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const items: (number | '...')[] = [1];
  if (current > 3) items.push('...');
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) items.push(p);
  if (current < total - 2) items.push('...');
  items.push(total);
  return items;
}

export function Paginator({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  const items = getPageItems(page, totalPages);
  return (
    <div className="mt-4 flex flex-wrap items-center gap-1">
      {page > 1 && (
        <a
          href={buildHref(page - 1)}
          className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          ← Anterior
        </a>
      )}
      {items.map((item, i) =>
        item === '...' ? (
          <span key={`e${i}`} className="px-1 text-sm text-gray-400">
            …
          </span>
        ) : (
          <a
            key={item}
            href={buildHref(item)}
            className={`rounded-lg px-3 py-1 text-sm ${
              item === page
                ? 'bg-primary text-white'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {item}
          </a>
        )
      )}
      {page < totalPages && (
        <a
          href={buildHref(page + 1)}
          className="rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
        >
          Siguiente →
        </a>
      )}
      <span className="ml-2 text-xs text-gray-400">
        Página {page} de {totalPages}
      </span>
    </div>
  );
}
