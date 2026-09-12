import { getDb, schema } from '@worldtune/db';
import { eq, or } from 'drizzle-orm';
import type { NextRequest } from 'next/server';

/**
 * Relay de audio para emisoras que solo sirven http://.
 *
 * Una pagina https no puede reproducir un stream http (contenido mixto), y eso
 * deja fuera a buena parte de los Icecast del mundo. Este proxy existe solo para
 * eso.
 *
 * Tres limites deliberados:
 *  1. Solo reenvia URLs que ya estan en el catalogo. Sin esta comprobacion seria
 *     un proxy abierto para cualquiera, que es un problema de seguridad y de
 *     abuso, no un detalle.
 *  2. Solo audio: el video de terceros no se proxyea (redistribuirlo es otra cosa
 *     y ademas cuesta un ancho de banda que no tiene sentido pagar).
 *  3. No guarda nada: pasa los bytes y los olvida.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SECONDS = 60 * 60 * 3; // corta a las 3 h: evita conexiones zombis

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('u');
  if (!target) return new Response('Falta el parametro u', { status: 400 });

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response('URL invalida', { status: 400 });
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return new Response('Protocolo no permitido', { status: 400 });
  }

  const db = await getDb();
  const [known] = await db
    .select({ id: schema.stationStreams.id })
    .from(schema.stationStreams)
    .where(
      or(eq(schema.stationStreams.url, target), eq(schema.stationStreams.resolvedUrl, target)),
    )
    .limit(1);

  if (!known) {
    // No es un error del usuario: es la defensa contra usar esto como proxy abierto.
    return new Response('Ese stream no esta en el catalogo', { status: 403 });
  }

  const upstream = await fetch(url, {
    headers: {
      'User-Agent': process.env.USER_AGENT ?? 'WorldTune/0.1',
      Accept: '*/*',
      'Icy-MetaData': '1',
    },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  }).catch(() => null);

  if (!upstream?.ok || !upstream.body) {
    return new Response('La emisora no responde', { status: 502 });
  }

  const contentType = upstream.headers.get('content-type') ?? 'audio/mpeg';
  if (/text\/html/i.test(contentType)) {
    await upstream.body.cancel().catch(() => {});
    return new Response('El origen devolvio una pagina, no audio', { status: 502 });
  }

  const timeout = AbortSignal.timeout(MAX_SECONDS * 1000);
  timeout.addEventListener('abort', () => {
    void upstream.body?.cancel().catch(() => {});
  });

  return new Response(upstream.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      // El reproductor lee estos bytes desde el mismo origen, asi que no hace
      // falta abrir CORS a todo el mundo.
      'X-Content-Type-Options': 'nosniff',
      ...(upstream.headers.get('icy-name')
        ? { 'Icy-Name': upstream.headers.get('icy-name')! }
        : {}),
    },
  });
}
