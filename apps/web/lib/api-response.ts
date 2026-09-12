import type { NextRequest } from 'next/server';

/**
 * Utilidades comunes de la API pública (/api/v1).
 *
 * Existe como API de verdad, y no como consultas sueltas dentro de las páginas,
 * porque es lo que van a consumir las apps de Android y iOS: el teléfono no puede
 * hablar con PostgreSQL, así que este es el único camino.
 */

export interface Page<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  /** Página siguiente, o null si no hay más. Evita que el cliente calcule. */
  nextPage: number | null;
}

const MAX_LIMIT = 100;

export function readPaging(request: NextRequest, defaultLimit = 40) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);
  const limit = Math.min(
    Math.max(Number.parseInt(params.get('limit') ?? String(defaultLimit), 10) || defaultLimit, 1),
    MAX_LIMIT,
  );
  return { page, limit, offset: (page - 1) * limit };
}

export function paged<T>(data: T[], total: number, page: number, limit: number): Page<T> {
  return {
    data,
    page,
    limit,
    total,
    nextPage: page * limit < total ? page + 1 : null,
  };
}

/** Cabeceras de caché para respuestas de catálogo, que cambian una vez al día. */
export function catalogJson(body: unknown, seconds = 300): Response {
  return Response.json(body, {
    headers: {
      'Cache-Control': `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`,
      // Las apps móviles son otro origen: sin esto no pueden leer nada.
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export function notFound(what: string): Response {
  return Response.json({ error: `${what} no encontrado` }, { status: 404 });
}

/**
 * Cabeceras CORS para los endpoints que no pasan por catalogJson.
 *
 * Las apps móviles y cualquier cliente de otro origen necesitan esto; sin ello
 * el reporte de escucha a Radio Browser falla en silencio y el ranking de la
 * comunidad deja de recibir nuestra parte.
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

export function corsJson(body: unknown, init: ResponseInit = {}): Response {
  return Response.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers ?? {}) },
  });
}

/** Respuesta al preflight que dispara el navegador antes de un POST con JSON. */
export function corsPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
