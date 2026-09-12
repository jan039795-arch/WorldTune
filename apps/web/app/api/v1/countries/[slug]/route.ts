import { getCountryBySlug, listCities, listSubdivisions } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { catalogJson, notFound } from '@/lib/api-response';

/** País con sus estados y ciudades: una sola llamada para pintar la pantalla. */
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const kind = request.nextUrl.searchParams.get('kind') === 'tv' ? 'tv' : 'radio';
  const country = await getCountryBySlug(slug);
  if (!country) return notFound('país');

  const [subdivisions, cities] = await Promise.all([
    listSubdivisions(country.code, kind),
    listCities(country.code, undefined, kind),
  ]);
  return catalogJson({ country, subdivisions, cities }, 3600);
}
