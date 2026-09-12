import { listTopChannels, listTopStations, type RankingSource } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { catalogJson } from '@/lib/api-response';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/**
 * Rankings. La respuesta incluye siempre `source`, para que ningún cliente
 * pueda presentar como audiencia mundial algo que solo son nuestras propias
 * reproducciones.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number.parseInt(params.get('limit') ?? '10', 10) || 10, 1), 50);
  const source = (params.get('source') ?? 'listening') as RankingSource;
  const days = params.get('days') ? Number.parseInt(params.get('days')!, 10) : undefined;

  const valid: RankingSource[] = ['listening', 'voted', 'trending', 'local'];
  const safeSource = valid.includes(source) ? source : 'listening';

  const [stations, channels] = await Promise.all([
    listTopStations(safeSource, limit),
    listTopChannels(limit, Number.isFinite(days) ? days : undefined),
  ]);

  const names = await loadPlaceNames([...stations, ...channels]);

  return catalogJson(
    {
      stations: {
        source: safeSource === 'local' ? 'local' : 'radio-browser',
        // Qué significa exactamente el número que acompaña a cada fila.
        metric:
          safeSource === 'voted'
            ? 'votes'
            : safeSource === 'trending'
              ? 'trend'
              : safeSource === 'local'
                ? 'plays'
                : 'listeners24h',
        data: stations.map((row) => ({ ...row, place: placeLabel(names, row) })),
      },
      channels: {
        source: 'local',
        metric: 'plays',
        data: channels.map((row) => ({ ...row, place: placeLabel(names, row) })),
      },
    },
    600,
  );
}
