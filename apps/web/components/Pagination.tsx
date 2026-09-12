import Link from 'next/link';

/** Paginacion por enlaces: funciona sin JavaScript y es indexable. */
export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  query = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  query?: Record<string, string>;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams(query);
    if (target > 1) params.set('page', String(target));
    const suffix = params.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  return (
    <nav className="mt-5 flex items-center justify-between gap-3 text-sm" aria-label="Paginación">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className="focus-ring card px-3 py-1.5 transition hover:bg-ink-850"
          rel="prev"
        >
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      <span className="text-ink-500 tabular-nums">
        Página {page} de {pages}
      </span>
      {page < pages ? (
        <Link
          href={href(page + 1)}
          className="focus-ring card px-3 py-1.5 transition hover:bg-ink-850"
          rel="next"
        >
          Siguiente →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
