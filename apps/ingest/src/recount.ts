import { sql } from 'drizzle-orm';
import { getDb } from '@worldtune/db';
import { log, newCounters, type RunCounters } from './log';

/**
 * Recalcula los contadores desnormalizados que usa la navegacion.
 *
 * Se guardan en la tabla en vez de contarse en cada peticion porque la portada y
 * cada pagina de pais muestran decenas de facetas con su numero: hacerlo en vivo
 * son decenas de COUNT por vista.
 *
 * Solo se cuenta lo que el usuario puede realmente abrir (activo y reproducible
 * en web), de modo que no aparezca "Jalisco (412)" y luego una lista vacia.
 */
export async function recount(): Promise<RunCounters> {
  const counters = newCounters();
  const db = await getDb();

  const stationFilter = sql`s.is_active = true and s.web_playable = true`;
  const channelFilter = sql`c.is_active = true and c.web_playable = true and c.blocked_reason is null and c.is_nsfw = false`;

  log.info('recalculando contadores de paises');
  await db.execute(sql`
    update countries set
      station_count = coalesce((
        select count(*) from stations s
        where s.country_code = countries.code and ${stationFilter}
      ), 0),
      channel_count = coalesce((
        select count(*) from channels c
        where c.country_code = countries.code and ${channelFilter}
      ), 0)
  `);

  log.info('recalculando contadores de estados');
  await db.execute(sql`
    update subdivisions set
      station_count = coalesce((
        select count(*) from stations s
        where s.subdivision_code = subdivisions.code and ${stationFilter}
      ), 0),
      channel_count = coalesce((
        select count(*) from channels c
        where c.subdivision_code = subdivisions.code and ${channelFilter}
      ), 0)
  `);

  log.info('recalculando contadores de ciudades');
  await db.execute(sql`
    update cities set
      station_count = coalesce((
        select count(*) from stations s
        where s.city_code = cities.code and ${stationFilter}
      ), 0),
      channel_count = coalesce((
        select count(*) from channels c
        where c.city_code = cities.code and ${channelFilter}
      ), 0)
  `);

  log.info('recalculando contadores de generos');
  await db.execute(sql`
    update genres set
      station_count = coalesce((
        select count(*) from station_genres sg
        join stations s on s.id = sg.station_id
        where sg.genre_slug = genres.slug and ${stationFilter}
      ), 0),
      channel_count = coalesce((
        select count(*) from channel_genres cg
        join channels c on c.id = cg.channel_id
        where cg.genre_slug = genres.slug and ${channelFilter}
      ), 0)
  `);

  log.info('recalculando contadores de idiomas');
  await db.execute(sql`
    update languages set
      station_count = coalesce((
        select count(*) from station_languages sl
        join stations s on s.id = sl.station_id
        where sl.language_code = languages.code and ${stationFilter}
      ), 0)
  `);

  const summaryResult = await db.execute(sql`
    select
      (select count(*) from stations where is_active = true) as stations,
      (select count(*) from stations where is_active = true and web_playable = true) as stations_playable,
      (select count(*) from stations where city_code is not null) as stations_with_city,
      (select count(*) from stations where subdivision_code is not null) as stations_with_state,
      (select count(*) from channels where is_active = true and blocked_reason is null) as channels,
      (select count(*) from channels where is_active = true and web_playable = true and blocked_reason is null) as channels_playable,
      (select count(*) from countries where station_count > 0 or channel_count > 0) as countries,
      (select count(*) from cities where station_count > 0 or channel_count > 0) as cities
  `);

  // Cada driver devuelve una forma distinta: postgres-js entrega un array de
  // filas y PGlite un objeto { rows }. Se normaliza en vez de asumir una.
  const [summary] = rowsOf<Record<string, number>>(summaryResult);

  if (summary) {
    log.info('resumen del catalogo:');
    for (const [key, value] of Object.entries(summary)) log.info(`  ${key}: ${value}`);
  }
  counters.updated = 1;
  return counters;
}

/** Normaliza el resultado de db.execute entre drivers (array vs { rows }). */
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && typeof result === 'object' && 'rows' in result) {
    const rows = (result as { rows?: unknown }).rows;
    if (Array.isArray(rows)) return rows as T[];
  }
  return [];
}
