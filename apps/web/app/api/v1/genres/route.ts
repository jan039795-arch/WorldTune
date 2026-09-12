import { listGenres, listLanguages } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { catalogJson } from '@/lib/api-response';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind') === 'tv' ? 'tv' : 'radio';
  const [genres, languages] = await Promise.all([
    listGenres(kind),
    kind === 'radio' ? listLanguages() : Promise.resolve([]),
  ]);
  return catalogJson({ data: genres, languages }, 3600);
}
