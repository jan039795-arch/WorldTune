import { countStations, listStations } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { catalogJson, paged, readPaging } from '@/lib/api-response';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/** Listado de emisoras con los mismos filtros que la web. */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const { page, limit, offset } = readPaging(request);

  const filter = {
    countryCode: params.get('country') ?? undefined,
    subdivisionCode: params.get('state') ?? undefined,
    cityCode: params.get('city') ?? undefined,
    genre: params.get('genre') ?? undefined,
    language: params.get('language') ?? undefined,
    query: params.get('q') ?? undefined,
    order: (params.get('order') as 'popularity' | 'name' | 'recent' | null) ?? 'popularity',
  };

  const [rows, total] = await Promise.all([
    listStations({ ...filter, limit, offset }),
    countStations(filter),
  ]);
  const names = await loadPlaceNames(rows);

  // El cliente móvil recibe la ubicación ya formateada: repetir esa lógica en
  // cada plataforma es la forma más rápida de que dejen de coincidir.
  const data = rows.map((row) => ({ ...row, place: placeLabel(names, row) }));
  return catalogJson(paged(data, total, page, limit));
}
