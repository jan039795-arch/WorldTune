'use client';

import Link from 'next/link';
import type { Playable } from '@/lib/playable';
import { usePlayer } from '@/lib/player-store';
import { FavoriteButton } from './FavoriteButton';
import { StationLogo } from './StationLogo';

export interface StationCardData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  subtitle: string | null;
  bitrate: number | null;
  codec: string | null;
  streamUrl: string | null;
  container: string | null;
  needsProxy: boolean;
  genres?: string[];
}

export function StationCard({ station }: { station: StationCardData }) {
  const current = usePlayer((state) => state.current);
  const status = usePlayer((state) => state.status);
  const play = usePlayer((state) => state.play);

  const isCurrent = current?.id === station.id;
  const isPlaying = isCurrent && status === 'playing';
  const playable = Boolean(station.streamUrl);

  const item: Playable | null = station.streamUrl
    ? {
        kind: 'station',
        id: station.id,
        name: station.name,
        slug: station.slug,
        logoUrl: station.logoUrl,
        subtitle: station.subtitle,
        streamUrl: station.streamUrl,
        container: station.container ?? 'other',
        needsProxy: station.needsProxy,
      }
    : null;

  return (
    <div
      className="card group flex items-center gap-3 p-3 transition"
      style={isCurrent ? { borderColor: 'var(--color-brand-500)' } : undefined}
    >
      <button
        type="button"
        disabled={!playable}
        onClick={() => item && play(item)}
        aria-label={isPlaying ? `Pausar ${station.name}` : `Reproducir ${station.name}`}
        className="focus-ring relative shrink-0 rounded-lg disabled:opacity-40"
      >
        <StationLogo src={station.logoUrl} name={station.name} size={48} />
        <span
          className={`absolute inset-0 flex items-center justify-center rounded-lg bg-ink-950/65 transition ${
            isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <rect x="3.5" y="2.5" width="3.5" height="11" rx="1" />
              <rect x="9" y="2.5" width="3.5" height="11" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
              <path d="M4.5 2.8v10.4c0 .6.7 1 1.2.6l8-5.2c.5-.3.5-1 0-1.3l-8-5.2c-.5-.3-1.2 0-1.2.7z" />
            </svg>
          )}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <Link
          href={`/radio/emisora/${station.slug}`}
          className="focus-ring block truncate text-sm font-medium hover:underline"
        >
          {station.name}
        </Link>
        <p className="truncate text-xs text-ink-500">
          {station.subtitle ?? 'Sin ubicacion'}
          {station.bitrate ? ` · ${station.bitrate} kbps` : ''}
          {station.codec ? ` ${station.codec}` : ''}
        </p>
      </div>

      <FavoriteButton kind="station" id={station.id} name={station.name} slug={station.slug} />
    </div>
  );
}
