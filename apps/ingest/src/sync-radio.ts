import { inArray, sql } from 'drizzle-orm';
import {
  GeoIndex,
  analyzeStream,
  cleanName,
  entitySlug,
  isWebPlayable,
  normalizeTags,
  scoreStream,
  shortHash,
} from '@worldtune/core';
import {
  cities,
  countries,
  getDb,
  stationGenres,
  stationLanguages,
  stationStreams,
  stations,
  subdivisions,
  unknownTags,
} from '@worldtune/db';
import { RadioBrowserClient, type RbStation } from '@worldtune/sources';
import { log, newCounters, type RunCounters } from './log';
import { chunk, excluded } from './util';

/**
 * Ingesta de emisoras desde Radio Browser.
 *
 * Lo delicado no es traer las filas, es geolocalizarlas: Radio Browser da el
 * estado como texto libre y no da ciudad. Aqui se casa contra la jerarquia ISO
 * ya cargada por sync:geo y, cuando no hay mas remedio, se busca el nombre de la
 * ciudad dentro del nombre de la emisora.
 */

const RELAY_ENABLED = process.env.NEXT_PUBLIC_RELAY_ENABLED !== 'false';

export interface SyncRadioOptions {
  countryCode?: string;
  limit?: number;
  pageSize?: number;
  /** Fila desde la que continuar si una ejecucion anterior se corto. */
  offset?: number;
  /** Desactiva las emisoras que ya no aparecen en la fuente (solo en sync completo). */
  prune?: boolean;
}

export async function syncRadio(options: SyncRadioOptions = {}): Promise<RunCounters> {
  const counters = newCounters();
  const runStart = new Date();
  const db = await getDb();
  const client = new RadioBrowserClient();

  const servers = await client.discover();
  log.info(`mirrors de Radio Browser: ${servers.length} (${servers[0]})`);
  const stats = await client.stats().catch(() => null);
  if (stats) log.info(`la fuente declara ${stats.stations} emisoras, ${stats.stations_broken} caidas`);

  const geo = await loadGeoIndex();
  const seen = new Set<string>();
  const unknownTagCounts = new Map<string, number>();
  let processed = options.offset ?? 0;
  let skipped = 0;

  for await (const page of client.stations({
    countryCode: options.countryCode,
    limit: options.limit,
    pageSize: options.pageSize ?? 1000,
    offset: options.offset,
  })) {
    const stationRows: Array<typeof stations.$inferInsert> = [];
    const streamRows: Array<typeof stationStreams.$inferInsert> = [];
    const genreRows: Array<{ stationId: string; genreSlug: string }> = [];
    const languageRows: Array<{ stationId: string; languageCode: string }> = [];

    for (const raw of page) {
      const built = buildStation(raw, geo, unknownTagCounts);
      if (!built) {
        skipped++;
        continue;
      }
      seen.add(built.station.id!);
      stationRows.push(built.station);
      streamRows.push(...built.streams);
      genreRows.push(...built.genres);
      languageRows.push(...built.languages);
    }

    await persist(db, { stationRows, streamRows, genreRows, languageRows });
    processed += page.length;
    counters.inserted += stationRows.length;
    log.progress(processed, options.limit ?? stats?.stations ?? null, 'emisoras');
  }

  log.done(`procesadas ${processed} emisoras (${skipped} descartadas por datos incompletos)`);

  if (unknownTagCounts.size > 0) {
    const rows = [...unknownTagCounts.entries()]
      .filter(([, count]) => count >= 3)
      .map(([tag, count]) => ({ tag, count }));
    for (const batch of chunk(rows, 500)) {
      await db
        .insert(unknownTags)
        .values(batch)
        .onConflictDoUpdate({ target: unknownTags.tag, set: { count: excluded('count') } });
    }
    log.info(`tags sin clasificar guardados para revisar: ${rows.length}`);
  }

  if (options.prune && !options.limit && !options.countryCode && !options.offset) {
    // Todo lo que esta sincronizacion no toco ya no existe en la fuente. Se compara
    // por marca de tiempo en vez de un NOT IN con decenas de miles de ids.
    const result = await db
      .update(stations)
      .set({ isActive: false })
      .where(sql`${stations.isActive} = true and ${stations.updatedAt} < ${runStart}`);
    counters.deactivated = (result as { rowCount?: number }).rowCount ?? 0;
    log.info(`emisoras desactivadas por desaparecer de la fuente: ${counters.deactivated}`);
  }

  return counters;
}

interface BuiltStation {
  station: typeof stations.$inferInsert;
  streams: Array<typeof stationStreams.$inferInsert>;
  genres: Array<{ stationId: string; genreSlug: string }>;
  languages: Array<{ stationId: string; languageCode: string }>;
}

/** El indice geografico mas la comprobacion de paises validos del catalogo. */
type CatalogGeoIndex = GeoIndex & { hasCountry: (code: string) => boolean };

function buildStation(
  raw: RbStation,
  geo: CatalogGeoIndex,
  unknownTagCounts: Map<string, number>,
): BuiltStation | null {
  const name = cleanName(raw.name ?? '');
  const url = (raw.url_resolved || raw.url || '').trim();
  if (!name || !url || !/^https?:\/\//i.test(url)) return null;

  const countryCode = (raw.countrycode || '').toUpperCase();
  const country = geo.hasCountry(countryCode) ? countryCode : null;

  let subdivisionCode: string | null = null;
  let cityCode: string | null = null;
  if (country) {
    // El campo iso_3166_2 viene relleno pocas veces, pero cuando viene es fiable.
    const declared = raw.iso_3166_2?.trim().toUpperCase();
    const fromState = geo.matchSubdivision(country, raw.state);
    if (declared && geo.subdivision(declared)) subdivisionCode = declared;
    else subdivisionCode = fromState;

    cityCode = geo.resolveCity(country, {
      name,
      stateText: raw.state,
      subdivisionCode,
      // Si el texto del estado resolvio el estado, entonces es un estado y no
      // una ciudad: usarlo como ciudad inventa datos.
      stateIsSubdivision: fromState !== null,
    });
    // Si la ciudad trae estado y la emisora no, se hereda hacia arriba.
    if (cityCode && !subdivisionCode) subdivisionCode = geo.city(cityCode)?.subdivision ?? null;
  }

  const id = raw.stationuuid;
  const { genres: genreSlugs, unknown } = normalizeTags(raw.tags);
  for (const tag of unknown) unknownTagCounts.set(tag, (unknownTagCounts.get(tag) ?? 0) + 1);

  // Se guardan por separado: los clics son escucha real y los votos son
  // intencion. Mezclarlos sirve para ordenar listas, pero un "top 10 de las mas
  // escuchadas" tiene que poder ordenarse solo por clics.
  const clickCount = Math.max(raw.clickcount ?? 0, 0);
  const votes = Math.max(raw.votes ?? 0, 0);
  const popularity = Math.min(clickCount + votes * 2, 2_000_000_000);

  const urls = [...new Set([url, (raw.url || '').trim()].filter((u) => /^https?:\/\//i.test(u)))];
  const streams = urls.map((streamUrl) => {
    const facts = analyzeStream({ url: streamUrl, codec: raw.codec, hls: raw.hls === 1 });
    const webPlayable = isWebPlayable(facts, 'unknown', RELAY_ENABLED);
    return {
      id: `${id}-${shortHash(streamUrl)}`,
      stationId: id,
      url: streamUrl,
      container: facts.container,
      bitrate: raw.bitrate || null,
      isHttps: facts.isHttps,
      needsProxy: facts.needsProxy,
      webPlayable,
      status: 'unknown' as const,
      score: scoreStream({
        webPlayable,
        isHttps: facts.isHttps,
        status: 'unknown',
        bitrate: raw.bitrate,
        container: facts.container,
      }),
    };
  });

  // Optimista hasta que check:streams diga lo contrario: asi el catalogo sirve
  // desde la primera sincronizacion en vez de aparecer vacio.
  const best = streams.reduce<(typeof streams)[number] | null>(
    (winner, candidate) => (!winner || candidate.score > winner.score ? candidate : winner),
    null,
  );

  return {
    station: {
      id,
      name,
      slug: entitySlug(name, id),
      homepage: raw.homepage?.trim() || null,
      logoUrl: raw.favicon?.trim() || null,
      countryCode: country,
      subdivisionCode,
      cityCode,
      rawState: raw.state?.trim() || null,
      lat: raw.geo_lat,
      lon: raw.geo_long,
      codec: raw.codec || null,
      bitrate: raw.bitrate || null,
      clickCount,
      votes,
      popularity,
      clickTrend: raw.clicktrend ?? 0,
      isActive: true,
      bestStreamId: best?.id ?? null,
      webPlayable: best?.webPlayable ?? false,
      updatedAt: new Date(),
    },
    streams,
    genres: genreSlugs.map((genreSlug) => ({ stationId: id, genreSlug })),
    languages: parseLanguages(raw).map((languageCode) => ({ stationId: id, languageCode })),
  };
}

function parseLanguages(raw: RbStation): string[] {
  const codes = (raw.languagecodes ?? '')
    .split(',')
    .map((code) => code.trim().toLowerCase())
    .filter((code) => code.length === 2 || code.length === 3);
  return [...new Set(codes)].slice(0, 4);
}

async function persist(
  db: Awaited<ReturnType<typeof getDb>>,
  data: {
    stationRows: Array<typeof stations.$inferInsert>;
    streamRows: Array<typeof stationStreams.$inferInsert>;
    genreRows: Array<{ stationId: string; genreSlug: string }>;
    languageRows: Array<{ stationId: string; languageCode: string }>;
  },
): Promise<void> {
  if (data.stationRows.length === 0) return;

  for (const batch of chunk(data.stationRows, 200)) {
    await db
      .insert(stations)
      .values(batch)
      .onConflictDoUpdate({
        target: stations.id,
        set: {
          name: excluded('name'),
          slug: excluded('slug'),
          homepage: excluded('homepage'),
          logoUrl: excluded('logo_url'),
          countryCode: excluded('country_code'),
          subdivisionCode: excluded('subdivision_code'),
          cityCode: excluded('city_code'),
          rawState: excluded('raw_state'),
          lat: excluded('lat'),
          lon: excluded('lon'),
          codec: excluded('codec'),
          bitrate: excluded('bitrate'),
          clickCount: excluded('click_count'),
          votes: excluded('votes'),
          popularity: excluded('popularity'),
          clickTrend: excluded('click_trend'),
          isActive: excluded('is_active'),
          bestStreamId: excluded('best_stream_id'),
          updatedAt: excluded('updated_at'),
          // webPlayable NO se sobreescribe: manda el veredicto de check:streams.
        },
      });
  }

  for (const batch of chunk(data.streamRows, 200)) {
    await db
      .insert(stationStreams)
      .values(batch)
      .onConflictDoUpdate({
        target: stationStreams.id,
        set: {
          url: excluded('url'),
          container: excluded('container'),
          bitrate: excluded('bitrate'),
          isHttps: excluded('is_https'),
          needsProxy: excluded('needs_proxy'),
        },
      });
  }

  // Las relaciones se reescriben en bloque: es mas simple y barato que
  // calcular diferencias, y son tablas de dos columnas.
  const stationIds = data.stationRows.map((row) => row.id!);
  for (const batch of chunk(stationIds, 200)) {
    await db.delete(stationGenres).where(inArray(stationGenres.stationId, batch));
    await db.delete(stationLanguages).where(inArray(stationLanguages.stationId, batch));
  }
  for (const batch of chunk(data.genreRows, 500)) {
    await db.insert(stationGenres).values(batch).onConflictDoNothing();
  }
  for (const batch of chunk(data.languageRows, 500)) {
    await db.insert(stationLanguages).values(batch).onConflictDoNothing();
  }
}

async function loadGeoIndex(): Promise<CatalogGeoIndex> {
  const db = await getDb();
  const [subRows, cityRows] = await Promise.all([
    db
      .select({ code: subdivisions.code, country: subdivisions.countryCode, name: subdivisions.name })
      .from(subdivisions),
    db
      .select({
        code: cities.code,
        country: cities.countryCode,
        subdivision: cities.subdivisionCode,
        name: cities.name,
      })
      .from(cities),
  ]);
  if (subRows.length === 0) {
    throw new Error('no hay geografia cargada: ejecuta primero "ingest sync:geo"');
  }
  log.info(`indice geografico: ${subRows.length} estados, ${cityRows.length} ciudades`);

  const countryRows = await db.select({ code: countries.code }).from(countries);
  const countrySet = new Set(countryRows.map((r) => r.code));
  const index = new GeoIndex(subRows, cityRows) as CatalogGeoIndex;
  index.hasCountry = (code: string) => countrySet.has(code);
  return index;
}


