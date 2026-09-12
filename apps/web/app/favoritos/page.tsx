'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { readFavorites, toggleFavorite, type FavoriteEntry } from '@/components/FavoriteButton';
import { StationLogo } from '@/components/StationLogo';

/**
 * Favoritos del navegador. Es una pagina de cliente porque los datos viven en
 * localStorage: sin cuentas, sin servidor, y funciona desde el primer minuto.
 */
export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteEntry[] | null>(null);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    sync();
    window.addEventListener('worldtune:favorites', sync);
    return () => window.removeEventListener('worldtune:favorites', sync);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tus favoritos</h1>
        <p className="mt-1 text-sm text-ink-500">
          Se guardan en este navegador. Cuando existan cuentas, se podrán sincronizar entre
          dispositivos.
        </p>
      </div>

      {favorites === null ? (
        <p className="text-sm text-ink-500">Cargando…</p>
      ) : favorites.length === 0 ? (
        <div className="card p-6 text-center text-sm text-ink-500">
          Todavía no has guardado nada. Usa la estrella de cualquier emisora o canal.
          <div className="mt-3">
            <Link href="/radio" className="text-brand-400 hover:underline">
              Explorar radio
            </Link>
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((entry) => (
            <li key={`${entry.kind}-${entry.id}`} className="card flex items-center gap-3 p-3">
              <StationLogo src={null} name={entry.name} size={40} />
              <Link
                href={
                  entry.kind === 'station'
                    ? `/radio/emisora/${entry.slug}`
                    : `/tv/canal/${entry.slug}`
                }
                className="focus-ring min-w-0 flex-1"
              >
                <span className="block truncate text-sm font-medium">{entry.name}</span>
                <span className="block text-xs text-ink-500">
                  {entry.kind === 'station' ? 'Radio' : 'Televisión'}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  toggleFavorite(entry);
                  setFavorites(readFavorites());
                }}
                className="focus-ring chip hover:text-ink-100"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
