import { searchAll } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { catalogJson } from '@/lib/api-response';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/** Sugerencias del buscador de la cabecera. */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  const limit = Math.min(
    Math.max(Number.parseInt(request.nextUrl.searchParams.get('limit') ?? '6', 10) || 6, 1),
    20,
  );

  if (query.length < 2) return catalogJson({ results: [] }, 60);

  const { stations, channels } = await searchAll(query, limit);
  const names = await loadPlaceNames([...stations, ...channels]);

  const results = [
    ...stations.map((station) => ({
      kind: 'station' as const,
      name: station.name,
      slug: station.slug,
      logoUrl: station.logoUrl,
      subtitle: placeLabel(names, station),
    })),
    ...channels.map((channel) => ({
      kind: 'channel' as const,
      name: channel.name,
      slug: channel.slug,
      logoUrl: channel.logoUrl,
      subtitle: channel.network ?? placeLabel(names, channel),
    })),
  ].slice(0, limit);

  return catalogJson({ results }, 60);
}
