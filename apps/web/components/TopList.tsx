import Link from 'next/link';
import type { RankedChannel, RankedStation } from '@worldtune/db';
import { StationCard } from './StationCard';
import { StationLogo } from './StationLogo';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/**
 * Listas de ranking. Cada fila muestra el número que la coloca ahí, porque un
 * "top 10" sin la cifra detrás es solo una lista ordenada por fe.
 */

export type StationMetric = 'listeners24h' | 'votes' | 'trend' | 'plays';

/**
 * El texto de cada cifra importa tanto como la cifra. `clickcount` de Radio
 * Browser son escuchas de las últimas 24 h, no un acumulado: llamarlo "escuchas"
 * a secas haría creer que MANGORADIO tiene 575 oyentes en toda su historia.
 */
function formatMetric(value: number, metric: StationMetric): string {
  const number = new Intl.NumberFormat('es-MX', {
    notation: value >= 10_000 ? 'compact' : 'standard',
  }).format(value);
  switch (metric) {
    case 'votes':
      return `${number} ${value === 1 ? 'voto' : 'votos'}`;
    case 'trend':
      return `${value > 0 ? '+' : ''}${number} escuchas frente a ayer`;
    case 'plays':
      return `${number} ${value === 1 ? 'reproducción' : 'reproducciones'} aquí`;
    default:
      return `${number} escuchas en 24 h`;
  }
}

function metricValue(
  station: { clickCount: number; votes: number; clickTrend: number; playCount: number },
  metric: StationMetric,
): number {
  switch (metric) {
    case 'votes':
      return station.votes;
    case 'trend':
      return station.clickTrend;
    case 'plays':
      return station.playCount;
    default:
      return station.clickCount;
  }
}

export async function TopStations({
  stations,
  metric = 'listeners24h',
}: {
  stations: RankedStation[];
  metric?: StationMetric;
}) {
  if (stations.length === 0) {
    return <p className="card p-6 text-center text-sm text-ink-500">Todavía no hay datos.</p>;
  }
  const names = await loadPlaceNames(stations);

  return (
    <ol className="space-y-2">
      {stations.map((station, index) => (
        <li key={station.id} className="flex items-center gap-3">
          <span
            className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-500"
            aria-hidden
          >
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <StationCard
              station={{
                id: station.id,
                name: station.name,
                slug: station.slug,
                logoUrl: station.logoUrl,
                subtitle: `${formatMetric(metricValue(station, metric), metric)} · ${
                  placeLabel(names, station) ?? 'Sin ubicación'
                }`,
                bitrate: null,
                codec: null,
                streamUrl: station.streamUrl,
                container: station.container,
                needsProxy: station.needsProxy,
              }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}

export async function TopChannels({ channels }: { channels: RankedChannel[] }) {
  if (channels.length === 0) return null;
  const names = await loadPlaceNames(channels);

  return (
    <ol className="space-y-2">
      {channels.map((channel, index) => (
        <li key={channel.id} className="flex items-center gap-3">
          <span
            className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-500"
            aria-hidden
          >
            {index + 1}
          </span>
          <Link
            href={`/tv/canal/${channel.slug}`}
            className="focus-ring card flex min-w-0 flex-1 items-center gap-3 p-3 transition hover:bg-ink-850"
          >
            <StationLogo src={channel.logoUrl} name={channel.name} size={44} rounded="rounded-md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{channel.name}</p>
              <p className="truncate text-xs text-ink-500">
                {[channel.network ?? placeLabel(names, channel), formatMetric(channel.playCount, 'plays')]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            {!channel.webPlayable && <span className="chip">Solo en su sitio</span>}
          </Link>
        </li>
      ))}
    </ol>
  );
}
