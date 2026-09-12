import Link from 'next/link';

export interface Facet {
  href: string;
  label: string;
  count?: number;
  /** Emoji de bandera o similar. */
  icon?: string | null;
}

/**
 * Rejilla de enlaces con su numero: paises, estados, ciudades, generos. El
 * contador sale de las columnas precalculadas y solo cuenta lo reproducible, de
 * modo que "Jalisco (76)" siempre lleva a 76 emisoras que suenan.
 */
export function FacetGrid({ facets, columns = 'auto' }: { facets: Facet[]; columns?: 'auto' | 'wide' }) {
  if (facets.length === 0) {
    return <p className="text-sm text-ink-500">Todavía no hay nada aquí.</p>;
  }
  return (
    <ul
      className={
        columns === 'wide'
          ? 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'
          : 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4'
      }
    >
      {facets.map((facet) => (
        <li key={facet.href}>
          <Link
            href={facet.href}
            className="focus-ring card flex items-center gap-2 px-3 py-2.5 text-sm transition hover:bg-ink-850"
          >
            {facet.icon && (
              <span aria-hidden className="text-base leading-none">
                {facet.icon}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">{facet.label}</span>
            {facet.count !== undefined && (
              <span className="shrink-0 text-xs tabular-nums text-ink-500">{facet.count}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: Array<{ href?: string; label: string }> }) {
  return (
    <nav aria-label="Ruta" className="mb-4 flex flex-wrap items-center gap-1 text-sm text-ink-500">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="focus-ring hover:text-ink-100 hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink-300">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
