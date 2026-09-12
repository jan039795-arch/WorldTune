import type { StationCard as StationRow } from '@worldtune/db';
import { StationCard } from './StationCard';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/**
 * Lista de emisoras. Es un componente de servidor que resuelve los nombres de
 * los lugares en una sola consulta y luego entrega tarjetas de cliente, que son
 * las que necesitan interactividad para reproducir.
 */
export async function StationList({
  stations,
  emptyMessage = 'No hay emisoras que suenen en este momento aquí.',
}: {
  stations: StationRow[];
  emptyMessage?: string;
}) {
  if (stations.length === 0) {
    return (
      <p className="card p-6 text-center text-sm text-ink-500">{emptyMessage}</p>
    );
  }

  const names = await loadPlaceNames(stations);

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {stations.map((station) => (
        <li key={station.id}>
          <StationCard
            station={{
              id: station.id,
              name: station.name,
              slug: station.slug,
              logoUrl: station.logoUrl,
              subtitle: placeLabel(names, station),
              bitrate: station.bitrate,
              codec: station.codec,
              streamUrl: station.streamUrl,
              container: station.container,
              needsProxy: station.needsProxy,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
