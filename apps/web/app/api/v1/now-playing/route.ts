import { getDb, schema } from '@worldtune/db';
import { desc, eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { catalogJson, corsJson } from '@/lib/api-response';

/**
 * "Ahora suena". Los metadatos ICY que viajan dentro del stream no se pueden leer
 * desde el navegador con un <audio>, asi que se preguntan aqui: muchos Icecast,
 * Shoutcast y AzuraCast publican un endpoint de estado junto al stream.
 *
 * Es best effort por diseno: si la emisora no lo expone, la ficha simplemente no
 * muestra la cancion.
 */

export const runtime = 'nodejs';
export const revalidate = 20;

export async function GET(request: NextRequest) {
  const stationId = request.nextUrl.searchParams.get('station');
  if (!stationId) return corsJson({ title: null }, { status: 400 });

  const db = await getDb();
  const [stream] = await db
    .select({ url: schema.stationStreams.url, resolved: schema.stationStreams.resolvedUrl })
    .from(schema.stationStreams)
    .where(eq(schema.stationStreams.stationId, stationId))
    .orderBy(desc(schema.stationStreams.score))
    .limit(1);

  if (!stream) return corsJson({ title: null }, { status: 404 });

  const title = await probeMetadata(stream.resolved ?? stream.url);
  return catalogJson({ title }, 20);
}

async function probeMetadata(streamUrl: string): Promise<string | null> {
  let base: URL;
  try {
    base = new URL(streamUrl);
  } catch {
    return null;
  }

  // Rutas habituales de los paneles de estado, en orden de probabilidad.
  const candidates = [
    new URL('/status-json.xsl', base), // Icecast 2
    new URL('/api/nowplaying_static/1.json', base), // AzuraCast
    new URL('/stats?json=1', base), // Shoutcast v2
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate, {
        signal: AbortSignal.timeout(4000),
        headers: { 'User-Agent': process.env.USER_AGENT ?? 'WorldTune/0.1' },
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => {});
        continue;
      }
      const data = (await response.json()) as unknown;
      const title = extractTitle(data);
      if (title) return title;
    } catch {
      // siguiente candidato
    }
  }
  return null;
}

/** Cada software publica la cancion en un sitio distinto del JSON. */
function extractTitle(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, any>;

  // Icecast: icestats.source puede ser objeto o array de fuentes.
  const source = record.icestats?.source;
  if (source) {
    const first = Array.isArray(source) ? source[0] : source;
    const title = first?.title ?? first?.yp_currently_playing;
    if (typeof title === 'string' && title.trim()) return clean(title);
  }

  // AzuraCast
  const azura = record.now_playing?.song?.text;
  if (typeof azura === 'string' && azura.trim()) return clean(azura);

  // Shoutcast
  if (typeof record.songtitle === 'string' && record.songtitle.trim()) return clean(record.songtitle);

  return null;
}

function clean(title: string): string {
  return title.replace(/\s+/g, ' ').trim().slice(0, 160);
}
