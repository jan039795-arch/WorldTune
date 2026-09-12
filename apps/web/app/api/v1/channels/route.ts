import { countChannels, listChannels } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { catalogJson, paged, readPaging } from '@/lib/api-response';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/** Listado de canales de televisión. */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { page, limit, offset } = readPaging(request);

  const filter = {
    countryCode: params.get('country') ?? undefined,
    subdivisionCode: params.get('state') ?? undefined,
    cityCode: params.get('city') ?? undefined,
    genre: params.get('genre') ?? undefined,
    query: params.get('q') ?? undefined,
  };

  const [rows, total] = await Promise.all([
    listChannels({ ...filter, limit, offset }),
    countChannels(filter),
  ]);
  const names = await loadPlaceNames(rows);
  const data = rows.map((row) => ({ ...row, place: placeLabel(names, row) }));
  return catalogJson(paged(data, total, page, limit));
}
