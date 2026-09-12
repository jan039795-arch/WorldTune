import { and, asc, desc, eq, gt, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from './client';
import {
  channelGenres,
  channelStreams,
  channels,
  cities,
  countries,
  genres,
  languages,
  stationGenres,
  playStats,
  stationLanguages,
  stationStreams,
  stations,
  subdivisions,
} from './schema';

/**
 * Capa de lectura que consume la web. Vive aqui y no en los componentes para que
 * las apps moviles (y una futura API publica) usen exactamente las mismas
 * consultas en vez de reimplementarlas.
 */

export interface BrowseFilter {
  countryCode?: string;
  subdivisionCode?: string;
  cityCode?: string;
  genre?: string;
  language?: string;
  query?: string;
  /** Por defecto true: no se muestra lo que no suena. */
  onlyPlayable?: boolean;
  curatedOnly?: boolean;
  limit?: number;
  offset?: number;
  order?: 'popularity' | 'name' | 'recent';
}

const PAGE = 60;

// ------------------------------------------------------------------ Geografia

export async function listCountries(kind: 'radio' | 'tv' = 'radio') {
  const db = await getDb();
  const countColumn = kind === 'radio' ? countries.stationCount : countries.channelCount;
  return db
    .select({
      code: countries.code,
      name: countries.name,
      nameEs: countries.nameEs,
      slug: countries.slug,
      flag: countries.flag,
      regionCode: countries.regionCode,
      count: countColumn,
    })
    .from(countries)
    .where(gt(countColumn, 0))
    .orderBy(desc(countColumn));
}

export async function getCountryBySlug(slug: string) {
  const db = await getDb();
  const [row] = await db.select().from(countries).where(eq(countries.slug, slug)).limit(1);
  return row ?? null;
}

export async function listSubdivisions(countryCode: string, kind: 'radio' | 'tv' = 'radio') {
  const db = await getDb();
  const countColumn = kind === 'radio' ? subdivisions.stationCount : subdivisions.channelCount;
  return db
    .select({
      code: subdivisions.code,
      name: subdivisions.name,
      slug: subdivisions.slug,
      count: countColumn,
    })
    .from(subdivisions)
    .where(and(eq(subdivisions.countryCode, countryCode), gt(countColumn, 0)))
    .orderBy(desc(countColumn));
}

export async function getSubdivisionBySlug(countryCode: string, slug: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(subdivisions)
    .where(and(eq(subdivisions.countryCode, countryCode), eq(subdivisions.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function listCities(
  countryCode: string,
  subdivisionCode?: string,
  kind: 'radio' | 'tv' = 'radio',
) {
  const db = await getDb();
  const countColumn = kind === 'radio' ? cities.stationCount : cities.channelCount;
  const filters: SQL[] = [eq(cities.countryCode, countryCode), gt(countColumn, 0)];
  if (subdivisionCode) filters.push(eq(cities.subdivisionCode, subdivisionCode));
  return db
    .select({
      code: cities.code,
      name: cities.name,
      slug: cities.slug,
      subdivisionCode: cities.subdivisionCode,
      count: countColumn,
    })
    .from(cities)
    .where(and(...filters))
    .orderBy(desc(countColumn));
}

export async function getCityBySlug(countryCode: string, slug: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(cities)
    .where(and(eq(cities.countryCode, countryCode), eq(cities.slug, slug)))
    .limit(1);
  return row ?? null;
}

export async function listGenres(kind: 'radio' | 'tv') {
  const db = await getDb();
  const countColumn = kind === 'radio' ? genres.stationCount : genres.channelCount;
  return db
    .select({
      slug: genres.slug,
      name: genres.name,
      nameEs: genres.nameEs,
      parentSlug: genres.parentSlug,
      count: countColumn,
    })
    .from(genres)
    .where(and(gt(countColumn, 0), inArray(genres.kind, [kind, 'both'])))
    .orderBy(desc(countColumn));
}

export async function listLanguages() {
  const db = await getDb();
  return db
    .select()
    .from(languages)
    .where(gt(languages.stationCount, 0))
    .orderBy(desc(languages.stationCount));
}

// ------------------------------------------------------------------ Radio

function stationFilters(filter: BrowseFilter): SQL[] {
  const where: SQL[] = [eq(stations.isActive, true)];
  if (filter.onlyPlayable !== false) where.push(eq(stations.webPlayable, true));
  if (filter.curatedOnly) where.push(eq(stations.curated, true));
  if (filter.countryCode) where.push(eq(stations.countryCode, filter.countryCode));
  if (filter.subdivisionCode) where.push(eq(stations.subdivisionCode, filter.subdivisionCode));
  if (filter.cityCode) where.push(eq(stations.cityCode, filter.cityCode));
  if (filter.query) {
    const pattern = `%${filter.query}%`;
    where.push(or(ilike(stations.name, pattern), ilike(stations.rawState, pattern))!);
  }
  return where;
}

export interface StationCard {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  countryCode: string | null;
  subdivisionCode: string | null;
  cityCode: string | null;
  bitrate: number | null;
  codec: string | null;
  popularity: number;
  webPlayable: boolean;
  streamUrl: string | null;
  container: string | null;
  needsProxy: boolean;
}

/** Lista de emisoras con el mejor stream ya resuelto, sin N+1. */
export async function listStations(filter: BrowseFilter = {}): Promise<StationCard[]> {
  const db = await getDb();
  const where = stationFilters(filter);
  const orderBy =
    filter.order === 'name'
      ? asc(stations.name)
      : filter.order === 'recent'
        ? desc(stations.createdAt)
        : desc(stations.popularity);

  let rows = db
    .select({
      id: stations.id,
      name: stations.name,
      slug: stations.slug,
      logoUrl: stations.logoUrl,
      countryCode: stations.countryCode,
      subdivisionCode: stations.subdivisionCode,
      cityCode: stations.cityCode,
      bitrate: stations.bitrate,
      codec: stations.codec,
      popularity: stations.popularity,
      webPlayable: stations.webPlayable,
      streamUrl: sql<string | null>`coalesce(${stationStreams.resolvedUrl}, ${stationStreams.url})`,
      container: stationStreams.container,
      needsProxy: sql<boolean>`coalesce(${stationStreams.needsProxy}, false)`,
    })
    .from(stations)
    .leftJoin(stationStreams, eq(stationStreams.id, stations.bestStreamId))
    .$dynamic();

  if (filter.genre) {
    rows = rows.innerJoin(stationGenres, eq(stationGenres.stationId, stations.id));
    where.push(eq(stationGenres.genreSlug, filter.genre));
  }
  if (filter.language) {
    rows = rows.innerJoin(stationLanguages, eq(stationLanguages.stationId, stations.id));
    where.push(eq(stationLanguages.languageCode, filter.language));
  }
  rows = rows.where(and(...where));

  return rows
    .orderBy(orderBy)
    .limit(filter.limit ?? PAGE)
    .offset(filter.offset ?? 0) as unknown as Promise<StationCard[]>;
}

export async function countStations(filter: BrowseFilter = {}): Promise<number> {
  const db = await getDb();
  const where = stationFilters(filter);
  let query = db.select({ total: sql<number>`count(*)::int` }).from(stations).$dynamic();
  if (filter.genre) {
    query = query.innerJoin(stationGenres, eq(stationGenres.stationId, stations.id));
    where.push(eq(stationGenres.genreSlug, filter.genre));
  }
  if (filter.language) {
    query = query.innerJoin(stationLanguages, eq(stationLanguages.stationId, stations.id));
    where.push(eq(stationLanguages.languageCode, filter.language));
  }
  const [row] = (await query.where(and(...where))) as Array<{ total: number }>;
  return row?.total ?? 0;
}

export async function getStationBySlug(slug: string) {
  const db = await getDb();
  const [station] = await db.select().from(stations).where(eq(stations.slug, slug)).limit(1);
  if (!station) return null;

  const [streams, tags] = await Promise.all([
    db
      .select()
      .from(stationStreams)
      .where(eq(stationStreams.stationId, station.id))
      .orderBy(desc(stationStreams.score)),
    db
      .select({ slug: genres.slug, name: genres.name, nameEs: genres.nameEs })
      .from(stationGenres)
      .innerJoin(genres, eq(genres.slug, stationGenres.genreSlug))
      .where(eq(stationGenres.stationId, station.id)),
  ]);

  return { station, streams, genres: tags };
}

/** Emisoras parecidas: mismo pais y algun genero en comun. */
export async function listSimilarStations(stationId: string, limit = 12): Promise<StationCard[]> {
  const db = await getDb();
  const [target] = await db
    .select({ countryCode: stations.countryCode })
    .from(stations)
    .where(eq(stations.id, stationId))
    .limit(1);
  if (!target?.countryCode) return [];

  const tags = await db
    .select({ slug: stationGenres.genreSlug })
    .from(stationGenres)
    .where(eq(stationGenres.stationId, stationId));

  if (tags.length === 0) {
    return listStations({ countryCode: target.countryCode, limit });
  }

  const rows = await db
    .select({
      id: stations.id,
      name: stations.name,
      slug: stations.slug,
      logoUrl: stations.logoUrl,
      countryCode: stations.countryCode,
      subdivisionCode: stations.subdivisionCode,
      cityCode: stations.cityCode,
      bitrate: stations.bitrate,
      codec: stations.codec,
      popularity: stations.popularity,
      webPlayable: stations.webPlayable,
      streamUrl: sql<string | null>`coalesce(${stationStreams.resolvedUrl}, ${stationStreams.url})`,
      container: stationStreams.container,
      needsProxy: sql<boolean>`coalesce(${stationStreams.needsProxy}, false)`,
      shared: sql<number>`count(distinct ${stationGenres.genreSlug})::int`,
    })
    .from(stations)
    .innerJoin(stationGenres, eq(stationGenres.stationId, stations.id))
    .leftJoin(stationStreams, eq(stationStreams.id, stations.bestStreamId))
    .where(
      and(
        eq(stations.isActive, true),
        eq(stations.webPlayable, true),
        eq(stations.countryCode, target.countryCode),
        sql`${stations.id} <> ${stationId}`,
        inArray(
          stationGenres.genreSlug,
          tags.map((t) => t.slug),
        ),
      ),
    )
    .groupBy(
      stations.id,
      stations.name,
      stations.slug,
      stations.logoUrl,
      stations.countryCode,
      stations.subdivisionCode,
      stations.cityCode,
      stations.bitrate,
      stations.codec,
      stations.popularity,
      stations.webPlayable,
      stationStreams.resolvedUrl,
      stationStreams.url,
      stationStreams.container,
      stationStreams.needsProxy,
    )
    .orderBy(desc(sql`count(distinct ${stationGenres.genreSlug})`), desc(stations.popularity))
    .limit(limit);

  return rows as unknown as StationCard[];
}

// ------------------------------------------------------------------ Television

function channelFilters(filter: BrowseFilter): SQL[] {
  const where: SQL[] = [
    eq(channels.isActive, true),
    eq(channels.isNsfw, false),
    // Un canal vetado no aparece en ninguna consulta, nunca.
    sql`${channels.blockedReason} is null`,
  ];
  // Un canal curado se lista aunque no sea reproducible aqui: son cadenas grandes
  // que solo emiten en su propio reproductor y la ficha enlaza a su sitio.
  if (filter.onlyPlayable !== false) {
    where.push(or(eq(channels.webPlayable, true), eq(channels.curated, true))!);
  }
  if (filter.curatedOnly) where.push(eq(channels.curated, true));
  if (filter.countryCode) where.push(eq(channels.countryCode, filter.countryCode));
  if (filter.subdivisionCode) where.push(eq(channels.subdivisionCode, filter.subdivisionCode));
  if (filter.cityCode) where.push(eq(channels.cityCode, filter.cityCode));
  if (filter.query) where.push(ilike(channels.name, `%${filter.query}%`));
  return where;
}

export interface ChannelCard {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  countryCode: string | null;
  network: string | null;
  webPlayable: boolean;
  curated: boolean;
  website: string | null;
  streamUrl: string | null;
  container: string | null;
  quality: string | null;
  labels: string[] | null;
}

export async function listChannels(filter: BrowseFilter = {}): Promise<ChannelCard[]> {
  const db = await getDb();
  const where = channelFilters(filter);

  let rows = db
    .select({
      id: channels.id,
      name: channels.name,
      slug: channels.slug,
      logoUrl: channels.logoUrl,
      countryCode: channels.countryCode,
      network: channels.network,
      webPlayable: channels.webPlayable,
      curated: channels.curated,
      website: channels.website,
      streamUrl: sql<string | null>`coalesce(${channelStreams.resolvedUrl}, ${channelStreams.url})`,
      container: channelStreams.container,
      quality: channelStreams.quality,
      labels: channelStreams.labels,
    })
    .from(channels)
    .leftJoin(channelStreams, eq(channelStreams.id, channels.bestStreamId))
    .$dynamic();

  if (filter.genre) {
    rows = rows
      .innerJoin(channelGenres, eq(channelGenres.channelId, channels.id))
      .where(and(...where, eq(channelGenres.genreSlug, filter.genre)));
  } else {
    rows = rows.where(and(...where));
  }

  return rows
    .orderBy(asc(channels.name))
    .limit(filter.limit ?? PAGE)
    .offset(filter.offset ?? 0) as unknown as Promise<ChannelCard[]>;
}

export async function countChannels(filter: BrowseFilter = {}): Promise<number> {
  const db = await getDb();
  const where = channelFilters(filter);
  let query = db.select({ total: sql<number>`count(*)::int` }).from(channels).$dynamic();
  if (filter.genre) {
    query = query
      .innerJoin(channelGenres, eq(channelGenres.channelId, channels.id))
      .where(and(...where, eq(channelGenres.genreSlug, filter.genre)));
  } else {
    query = query.where(and(...where));
  }
  const [row] = (await query) as Array<{ total: number }>;
  return row?.total ?? 0;
}

export async function getChannelBySlug(slug: string) {
  const db = await getDb();
  const [channel] = await db
    .select()
    .from(channels)
    .where(and(eq(channels.slug, slug), sql`${channels.blockedReason} is null`))
    .limit(1);
  if (!channel) return null;

  const [streams, tags] = await Promise.all([
    db
      .select()
      .from(channelStreams)
      .where(eq(channelStreams.channelId, channel.id))
      .orderBy(desc(channelStreams.score)),
    db
      .select({ slug: genres.slug, name: genres.name, nameEs: genres.nameEs })
      .from(channelGenres)
      .innerJoin(genres, eq(genres.slug, channelGenres.genreSlug))
      .where(eq(channelGenres.channelId, channel.id)),
  ]);

  return { channel, streams, genres: tags };
}

// ------------------------------------------------------------------ Portada

export async function getCatalogStats() {
  const db = await getDb();
  const [row] = await db
    .select({
      stations: sql<number>`(select count(*) from ${stations} where ${stations.webPlayable} = true and ${stations.isActive} = true)::int`,
      channels: sql<number>`(select count(*) from ${channels} where ${channels.webPlayable} = true and ${channels.isActive} = true and ${channels.blockedReason} is null)::int`,
      countries: sql<number>`(select count(*) from ${countries} where ${countries.stationCount} > 0 or ${countries.channelCount} > 0)::int`,
      cities: sql<number>`(select count(*) from ${cities} where ${cities.stationCount} > 0 or ${cities.channelCount} > 0)::int`,
    })
    .from(sql`(select 1) as t`);
  return row ?? { stations: 0, channels: 0, countries: 0, cities: 0 };
}

/** Busqueda unificada para la barra superior. */
export async function searchAll(query: string, limit = 10) {
  if (query.trim().length < 2) return { stations: [], channels: [] };
  const [stationRows, channelRows] = await Promise.all([
    listStations({ query, limit }),
    listChannels({ query, limit }),
  ]);
  return { stations: stationRows, channels: channelRows };
}

export { isNotNull };

// ------------------------------------------------------------------ Rankings

/**
 * Los "top" tienen procedencias distintas y la interfaz debe decir cuál es cuál.
 * Según la documentación de Radio Browser, sus campos significan exactamente:
 *
 *  - `listening` (clickcount): escuchas en las ÚLTIMAS 24 HORAS. No es un
 *    acumulado histórico, es lo que suena ahora mismo en el mundo.
 *  - `voted` (votes): votos de la comunidad, acumulados y que solo suben. Es
 *    reputación de siempre, no audiencia de hoy.
 *  - `trending` (clicktrend): diferencia de escuchas entre los dos últimos días.
 *  - `local`: reproducciones contadas por esta plataforma. Es lo ÚNICO honesto
 *    para televisión, porque iptv-org no publica ningún dato de espectadores.
 *
 * Mezclar las dos primeras bajo una sola etiqueta de "más escuchadas" sería
 * presentar votos históricos como si fueran oyentes actuales.
 */
export type RankingSource = 'listening' | 'voted' | 'trending' | 'local';

export interface RankedStation extends StationCard {
  clickCount: number;
  votes: number;
  clickTrend: number;
  playCount: number;
}

export async function listTopStations(
  source: RankingSource = 'listening',
  limit = 10,
): Promise<RankedStation[]> {
  const db = await getDb();
  const orderBy =
    source === 'voted'
      ? desc(stations.votes)
      : source === 'trending'
        ? desc(stations.clickTrend)
        : source === 'local'
          ? desc(stations.playCount)
          : desc(stations.clickCount);

  const rows = await db
    .select({
      id: stations.id,
      name: stations.name,
      slug: stations.slug,
      logoUrl: stations.logoUrl,
      countryCode: stations.countryCode,
      subdivisionCode: stations.subdivisionCode,
      cityCode: stations.cityCode,
      bitrate: stations.bitrate,
      codec: stations.codec,
      popularity: stations.popularity,
      clickCount: stations.clickCount,
      votes: stations.votes,
      clickTrend: stations.clickTrend,
      playCount: stations.playCount,
      webPlayable: stations.webPlayable,
      streamUrl: sql<string | null>`coalesce(${stationStreams.resolvedUrl}, ${stationStreams.url})`,
      container: stationStreams.container,
      needsProxy: sql<boolean>`coalesce(${stationStreams.needsProxy}, false)`,
    })
    .from(stations)
    .leftJoin(stationStreams, eq(stationStreams.id, stations.bestStreamId))
    .where(and(eq(stations.isActive, true), eq(stations.webPlayable, true)))
    .orderBy(orderBy)
    .limit(limit);

  return rows as unknown as RankedStation[];
}

export interface RankedChannel extends ChannelCard {
  playCount: number;
}

/**
 * Top de televisión. Solo hay una fuente posible: nuestras propias
 * reproducciones. Devuelve lista vacía mientras nadie haya visto nada, y esa
 * lista vacía es la respuesta correcta, no un fallo.
 */
export async function listTopChannels(limit = 10, days?: number): Promise<RankedChannel[]> {
  const db = await getDb();

  const base = {
    id: channels.id,
    name: channels.name,
    slug: channels.slug,
    logoUrl: channels.logoUrl,
    countryCode: channels.countryCode,
    network: channels.network,
    webPlayable: channels.webPlayable,
    curated: channels.curated,
    website: channels.website,
    streamUrl: sql<string | null>`coalesce(${channelStreams.resolvedUrl}, ${channelStreams.url})`,
    container: channelStreams.container,
    quality: channelStreams.quality,
    labels: channelStreams.labels,
  };

  const visible = and(
    eq(channels.isActive, true),
    eq(channels.isNsfw, false),
    sql`${channels.blockedReason} is null`,
  );

  if (days === undefined) {
    const rows = await db
      .select({ ...base, playCount: channels.playCount })
      .from(channels)
      .leftJoin(channelStreams, eq(channelStreams.id, channels.bestStreamId))
      .where(and(visible, gt(channels.playCount, 0)))
      .orderBy(desc(channels.playCount))
      .limit(limit);
    return rows as unknown as RankedChannel[];
  }

  // Ventana temporal: se suma la serie diaria en vez del acumulado histórico.
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const rows = await db
    .select({ ...base, playCount: sql<number>`sum(${playStats.count})::int` })
    .from(channels)
    .innerJoin(
      playStats,
      and(eq(playStats.targetId, channels.id), eq(playStats.kind, 'channel')),
    )
    .leftJoin(channelStreams, eq(channelStreams.id, channels.bestStreamId))
    .where(and(visible, sql`${playStats.day} >= ${since}`))
    .groupBy(
      channels.id,
      channels.name,
      channels.slug,
      channels.logoUrl,
      channels.countryCode,
      channels.network,
      channels.webPlayable,
      channels.curated,
      channels.website,
      channelStreams.resolvedUrl,
      channelStreams.url,
      channelStreams.container,
      channelStreams.quality,
      channelStreams.labels,
    )
    .orderBy(desc(sql`sum(${playStats.count})`))
    .limit(limit);
  return rows as unknown as RankedChannel[];
}

/**
 * Registra una reproducción: contador acumulado y serie diaria, en una sola
 * transacción lógica. No guarda quién la hizo.
 */
export async function recordPlay(kind: 'station' | 'channel', id: string): Promise<void> {
  const db = await getDb();
  const day = new Date().toISOString().slice(0, 10);

  if (kind === 'station') {
    await db
      .update(stations)
      .set({ playCount: sql`${stations.playCount} + 1` })
      .where(eq(stations.id, id));
  } else {
    await db
      .update(channels)
      .set({ playCount: sql`${channels.playCount} + 1` })
      .where(eq(channels.id, id));
  }

  await db
    .insert(playStats)
    .values({ kind, targetId: id, day, count: 1 })
    .onConflictDoUpdate({
      target: [playStats.kind, playStats.targetId, playStats.day],
      set: { count: sql`${playStats.count} + 1` },
    });
}
