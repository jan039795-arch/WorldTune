'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { StationLogo } from './StationLogo';

interface Suggestion {
  kind: 'station' | 'channel';
  name: string;
  slug: string;
  logoUrl: string | null;
  subtitle: string | null;
}

/** Buscador con sugerencias. El Enter siempre lleva a la pagina completa. */
export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    // Se espera a que el usuario deje de escribir: la busqueda pega a la base de datos.
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=6`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as { results: Suggestion[] };
        setResults(data.results ?? []);
        setOpen(true);
      } catch {
        // busqueda cancelada o sin red
      }
    }, 220);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (query.trim().length >= 2) {
            setOpen(false);
            router.push(`/buscar?q=${encodeURIComponent(query.trim())}`);
          }
        }}
        role="search"
      >
        <label className="sr-only" htmlFor="buscador">
          Buscar emisoras y canales
        </label>
        <input
          id="buscador"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar emisora o canal…"
          autoComplete="off"
          className="focus-ring w-full rounded-full border bg-ink-900 px-4 py-1.5 text-sm placeholder:text-ink-500"
          style={{ borderColor: 'var(--border)' }}
        />
      </form>

      {open && results.length > 0 && (
        <ul
          className="card absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden p-1 shadow-xl"
          role="listbox"
        >
          {results.map((item) => (
            <li key={`${item.kind}-${item.slug}`}>
              <Link
                href={item.kind === 'station' ? `/radio/emisora/${item.slug}` : `/tv/canal/${item.slug}`}
                onClick={() => setOpen(false)}
                className="focus-ring flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-850"
              >
                <StationLogo src={item.logoUrl} name={item.name} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{item.name}</span>
                  <span className="block truncate text-xs text-ink-500">
                    {item.kind === 'station' ? 'Radio' : 'TV'}
                    {item.subtitle ? ` · ${item.subtitle}` : ''}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
