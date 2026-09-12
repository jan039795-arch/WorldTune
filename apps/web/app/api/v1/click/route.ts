import { recordPlay } from '@worldtune/db';
import { RadioBrowserClient } from '@worldtune/sources';
import type { NextRequest } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/api-response';

/**
 * Registra una reproducción. Hace dos cosas distintas y las dos importan:
 *
 *  1. Suma a nuestro propio contador. Para televisión es la única métrica de
 *     audiencia que existe, porque iptv-org no publica ninguna.
 *  2. Si es radio, devuelve la señal a Radio Browser. Su ranking mundial se
 *     construye con estos reportes: usar su catálogo sin devolver nada sería
 *     vivir del trabajo de la comunidad que lo mantiene.
 *
 * Nunca debe bloquear ni afectar a la reproducción, así que todo va en
 * best effort y responde igual aunque algo falle.
 */

export const runtime = 'nodejs';

const client = new RadioBrowserClient({ timeoutMs: 5000 });

export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // `station=` se mantiene por compatibilidad con la versión anterior.
  const legacyStation = params.get('station');
  const kind = legacyStation ? 'station' : params.get('kind');
  const id = legacyStation ?? params.get('id');

  if ((kind !== 'station' && kind !== 'channel') || !id) {
    return corsJson({ ok: false, error: 'kind e id son obligatorios' }, { status: 400 });
  }

  await recordPlay(kind, id).catch(() => {
    // el contador propio no debe romper la reproducción
  });

  if (kind === 'station' && /^[0-9a-f-]{36}$/i.test(id)) {
    await client.reportClick(id);
  }

  return corsJson({ ok: true });
}

export function OPTIONS(): Response {
  return corsPreflight();
}
