import { createHash, randomUUID } from 'node:crypto';
import { getDb, schema } from '@worldtune/db';
import type { NextRequest } from 'next/server';
import { corsJson, corsPreflight } from '@/lib/api-response';

/**
 * Reportes de enlaces caidos. Se guarda un hash de la IP, no la IP: sirve para
 * detectar abuso sin conservar un dato personal que no hace falta.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  let body: { kind?: string; id?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return corsJson({ ok: false, error: 'cuerpo invalido' }, { status: 400 });
  }

  if ((body.kind !== 'station' && body.kind !== 'channel') || !body.id) {
    return corsJson({ ok: false, error: 'kind e id son obligatorios' }, { status: 400 });
  }

  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const clientHash = forwarded
    ? createHash('sha256')
        .update(forwarded + (process.env.REPORT_SALT ?? 'worldtune'))
        .digest('hex')
        .slice(0, 32)
    : null;

  const db = await getDb();
  await db.insert(schema.streamReports).values({
    id: randomUUID(),
    kind: body.kind,
    targetId: body.id,
    reason: body.reason?.slice(0, 200) ?? null,
    clientHash,
  });

  return corsJson({ ok: true });
}

export function OPTIONS(): Response {
  return corsPreflight();
}
