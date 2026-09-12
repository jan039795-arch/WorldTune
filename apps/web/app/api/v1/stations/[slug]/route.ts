import { getStationBySlug, listSimilarStations } from '@worldtune/db';
import { catalogJson, notFound } from '@/lib/api-response';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/** Ficha completa de una emisora: datos, señales, géneros y parecidas. */
export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const data = await getStationBySlug(slug);
  if (!data) return notFound('emisora');

  const [names, similar] = await Promise.all([
    loadPlaceNames([data.station]),
    listSimilarStations(data.station.id, 12),
  ]);

  return catalogJson({
    station: { ...data.station, place: placeLabel(names, data.station) },
    // Solo las señales que el cliente puede abrir de verdad.
    streams: data.streams.filter((stream) => stream.webPlayable),
    genres: data.genres,
    similar,
  });
}
