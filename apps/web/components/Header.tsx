import Link from 'next/link';
import { SearchBox } from './SearchBox';

const NAV = [
  { href: '/radio', label: 'Radio' },
  { href: '/top', label: 'Top 10' },
  { href: '/tv', label: 'Televisión' },
  { href: '/favoritos', label: 'Favoritos' },
];

export function Header() {
  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{
        borderColor: 'var(--border)',
        background: 'color-mix(in oklab, var(--surface) 88%, transparent)',
      }}
    >
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <Link href="/" className="focus-ring flex items-center gap-2 font-semibold tracking-tight">
          <span
            className="flex size-7 items-center justify-center rounded-md bg-brand-500 text-ink-950"
            aria-hidden
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
              <circle cx="10" cy="12" r="4.2" />
              <path d="M3 8.5l14-4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          WorldTune
        </Link>

        <nav className="hidden gap-1 sm:flex" aria-label="Secciones">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="focus-ring rounded-md px-3 py-1.5 text-sm text-ink-300 transition hover:bg-ink-850 hover:text-ink-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto w-full max-w-xs">
          <SearchBox />
        </div>
      </div>
    </header>
  );
}
