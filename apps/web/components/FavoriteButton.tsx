'use client';

import { useEffect, useState } from 'react';

/**
 * Favoritos guardados en el navegador. Sin cuentas todavia: para un catalogo
 * publico no hace falta registrarse para marcar diez emisoras, y cuando llegue
 * la autenticacion este mismo formato se sube tal cual al servidor.
 */

const KEY = 'worldtune.favorites';

export interface FavoriteEntry {
  kind: 'station' | 'channel';
  id: string;
  name: string;
  slug: string;
  addedAt: number;
}

export function readFavorites(): FavoriteEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as FavoriteEntry[]) : [];
  } catch {
    return [];
  }
}

function writeFavorites(entries: FavoriteEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(entries.slice(0, 500)));
    window.dispatchEvent(new Event('worldtune:favorites'));
  } catch {
    // almacenamiento bloqueado: el favorito no persiste, la interfaz no se rompe
  }
}

export function toggleFavorite(entry: Omit<FavoriteEntry, 'addedAt'>): boolean {
  const entries = readFavorites();
  const index = entries.findIndex((item) => item.id === entry.id && item.kind === entry.kind);
  if (index >= 0) {
    entries.splice(index, 1);
    writeFavorites(entries);
    return false;
  }
  entries.unshift({ ...entry, addedAt: Date.now() });
  writeFavorites(entries);
  return true;
}

export function FavoriteButton({
  kind,
  id,
  name,
  slug,
}: {
  kind: 'station' | 'channel';
  id: string;
  name: string;
  slug: string;
}) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () =>
      setActive(readFavorites().some((item) => item.id === id && item.kind === kind));
    sync();
    window.addEventListener('worldtune:favorites', sync);
    return () => window.removeEventListener('worldtune:favorites', sync);
  }, [id, kind]);

  return (
    <button
      type="button"
      onClick={() => setActive(toggleFavorite({ kind, id, name, slug }))}
      aria-pressed={active}
      aria-label={active ? `Quitar ${name} de favoritos` : `Guardar ${name} en favoritos`}
      className="focus-ring shrink-0 rounded p-1.5 text-ink-500 transition hover:text-brand-400"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 20 20"
        fill={active ? 'var(--color-brand-500)' : 'none'}
        stroke={active ? 'var(--color-brand-500)' : 'currentColor'}
        strokeWidth="1.5"
        aria-hidden
      >
        <path d="M10 16.5l-4.6 2.5 1-5.2L2.5 10l5.2-.8L10 4.5l2.3 4.7 5.2.8-3.9 3.8 1 5.2z" />
      </svg>
    </button>
  );
}
