import { listCountries } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { catalogJson } from '@/lib/api-response';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('kind') === 'tv' ? 'tv' : 'radio';
  return catalogJson({ data: await listCountries(kind) }, 3600);
}
