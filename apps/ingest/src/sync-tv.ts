import { inArray, sql } from 'drizzle-orm';
import {
  analyzeStream,
  cleanName,
  entitySlug,
  isWebPlayable,
  normalizeTvCategory,
  parseBroadcastArea,
  scoreStream,
  shortHash,
} from '@worldtune/core';
import {
  channelGenres,
  channelLanguages,
  channelStreams,
  channels,
  cities,
  countries,
  getDb,
  subdivisions,
} from '@worldtune/db';
import {
  iptvOrg,
  loadBlockedChannelIds,
  type IoChannel,
  type IoFeed,
  type IoLogo,
  type IoStream,
} from '@worldtune/sources';
import { loadCuratedChannels, type CuratedChannel } from './curated';
import { log, newCounters, type RunCounters } from './log';
import { chunk, excluded } from './util';

/**
 * Ingesta de canales de television desde iptv-org.
 *
 * Reglas no negociables:
 *  - `blocklist.json` se aplica siempre. Un canal retirado por DMCA o marcado
 *    NSFW entra a la base marcado y jamas se publica.
 *  - Un stream que exige cabeceras `referrer` o `user_agent` no es reproducible
 *    en un navegador (JS no puede fijarlas), asi que se guarda pero no se ofrece.
 */

const RELAY_ENABLED = false; // el video no se proxyea: es redistribuir y sale caro

export interface SyncTvOptions {
  limit?: number;
  prune?: boolean;
}

export async function syncTv(options: SyncTvOptions = {}): Promise<RunCounters> {
  const counters = newCounters();
  const runStart = new Date();
  const db = await getDb();

  log.info('descargando catalogo de iptv-org');
  const [allChannels, feeds, streams, logos, blocked] = await Promise.all([
    iptvOrg.channels(),
    iptvOrg.feeds(),
    iptvOrg.streams(),
    iptvOrg.logos(),
    loadBlockedChannelIds(),
  ]);
  log.info(
    `fuente: ${allChannels.length} canales, ${feeds.length} senales, ${streams.length} streams, ${blocked.size} vetados`,
  );

  const geo = await loadGeoSets();
  const feedsByChannel = groupBy(feeds, (feed) => feed.channel);
  const streamsByChannel = groupBy(
    streams.filter((s) => s.channel),
    (s) => s.channel!,
  );
  const logoByChannel = pickLogos(logos);

  // El catalogo curado se mezcla ANTES de filtrar: canales como Canal Once estan
  // en iptv-org con todos sus datos pero sin ninguna senal, y sin esto se caerian.
  const curated = await loadCuratedChannels();
  const curatedById = new Map(curated.map((entry) => [entry.id, entry]));
  for (const entry of curated) {
    if (!entry.streams?.length) continue;
    const existing = streamsByChannel.get(entry.id) ?? [];
    streamsByChannel.set(entry.id, [
      ...entry.streams.map((stream) => ({
        channel: entry.id,
        feed: null,
        title: stream.title ?? null,
        url: stream.url,
        quality: stream.quality ?? null,
        labels: [],
        user_agent: null,
        referrer: null,
      })),
      ...existing,
    ]);
  }
  if (curated.length > 0) {
    log.info(
      `catalogo curado: ${curated.length} canales (${curated.filter((c) => c.streams?.length).length} con senal propia, ` +
        `${curated.filter((c) => c.soloSitioOficial).length} solo en su sitio)`,
    );
  }

  // Sin senal un canal es una ficha vacia y no entra... salvo que este curado:
  // un canal que solo emite en su propia web merece estar, enlazado.
  const candidates = allChannels.filter(
    (channel) => streamsByChannel.has(channel.id) || curatedById.has(channel.id),
  );
  const selected = options.limit ? candidates.slice(0, options.limit) : candidates;
  log.info(`canales con al menos un stream: ${candidates.length}`);

  const channelRows: Array<typeof channels.$inferInsert> = [];
  const streamRows: Array<typeof channelStreams.$inferInsert> = [];
  const genreRows: Array<{ channelId: string; genreSlug: string }> = [];
  const languageRows: Array<{ channelId: string; languageCode: string }> = [];
  const usedSlugs = new Set<string>();

  for (const channel of selected) {
    const built = buildChannel({
      channel,
      feeds: feedsByChannel.get(channel.id) ?? [],
      streams: streamsByChannel.get(channel.id) ?? [],
      logo: logoByChannel.get(channel.id) ?? null,
      blockedReason: blocked.get(channel.id) ?? null,
      curated: curatedById.get(channel.id) ?? null,
      geo,
      usedSlugs,
    });
    if (!built) {
      counters.errors++;
      continue;
    }
    channelRows.push(built.channel);
    streamRows.push(...built.streams);
    genreRows.push(...built.genres);
    languageRows.push(...built.languages);
  }

  log.info(`preparados ${channelRows.length} canales y ${streamRows.length} streams`);

  for (const batch of chunk(channelRows, 200)) {
    await db
      .insert(channels)
      .values(batch)
      .onConflictDoUpdate({
        target: channels.id,
        set: {
          name: excluded('name'),
          slug: excluded('slug'),
          altNames: excluded('alt_names'),
          network: excluded('network'),
          owners: excluded('owners'),
          website: excluded('website'),
          logoUrl: excluded('logo_url'),
          countryCode: excluded('country_code'),
          subdivisionCode: excluded('subdivision_code'),
          cityCode: excluded('city_code'),
          timezone: excluded('timezone'),
          isNsfw: excluded('is_nsfw'),
          blockedReason: excluded('blocked_reason'),
          blockedRef: excluded('blocked_ref'),
          launchedAt: excluded('launched_at'),
          closedAt: excluded('closed_at'),
          isActive: excluded('is_active'),
          curated: excluded('curated'),
          bestStreamId: excluded('best_stream_id'),
          updatedAt: excluded('updated_at'),
        },
      });
    counters.inserted += batch.length;
    log.progress(counters.inserted, channelRows.length, 'canales');
  }
  log.done(`canales guardados: ${counters.inserted}`);

  for (const batch of chunk(streamRows, 200)) {
    await db
      .insert(channelStreams)
      .values(batch)
      .onConflictDoUpdate({
        target: channelStreams.id,
        set: {
          url: excluded('url'),
          container: excluded('container'),
          quality: excluded('quality'),
          referrer: excluded('referrer'),
          userAgent: excluded('user_agent'),
          labels: excluded('labels'),
          isHttps: excluded('is_https'),
          title: excluded('title'),
          feedId: excluded('feed_id'),
        },
      });
  }

  const channelIds = channelRows.map((row) => row.id!);
  for (const batch of chunk(channelIds, 200)) {
    await db.delete(channelGenres).where(inArray(channelGenres.channelId, batch));
    await db.delete(channelLanguages).where(inArray(channelLanguages.channelId, batch));
  }
  for (const batch of chunk(genreRows, 500)) {
    await db.insert(channelGenres).values(batch).onConflictDoNothing();
  }
  for (const batch of chunk(languageRows, 500)) {
    await db.insert(channelLanguages).values(batch).onConflictDoNothing();
  }

  if (options.prune && !options.limit) {
    const result = await db
      .update(channels)
      .set({ isActive: false })
      .where(sql`${channels.isActive} = true and ${channels.updatedAt} < ${runStart}`);
    counters.deactivated = (result as { rowCount?: number }).rowCount ?? 0;
    log.info(`canales desactivados: ${counters.deactivated}`);
  }

  return counters;
}

interface GeoSets {
  countries: Set<string>;
  subdivisions: Map<string, string | null>;
  cities: Map<string, { country: string; subdivision: string | null }>;
}

interface BuiltChannel {
  channel: typeof channels.$inferInsert;
  streams: Array<typeof channelStreams.$inferInsert>;
  genres: Array<{ channelId: string; genreSlug: string }>;
  languages: Array<{ channelId: string; languageCode: string }>;
}

function buildChannel(input: {
  channel: IoChannel;
  feeds: IoFeed[];
  streams: IoStream[];
  logo: IoLogo | null;
  blockedReason: string | null;
  curated: CuratedChannel | null;
  geo: GeoSets;
  usedSlugs: Set<string>;
}): BuiltChannel | null {
  const { channel, geo } = input;
  const name = cleanName(channel.name ?? '');
  if (!name) return null;

  const mainFeed = input.feeds.find((feed) => feed.is_main) ?? input.feeds[0] ?? null;
  const location = resolveLocation(channel, mainFeed, geo);

  let slug = entitySlug(name, channel.id);
  while (input.usedSlugs.has(slug)) slug = `${slug}-2`;
  input.usedSlugs.add(slug);

  const streamRows = input.streams.map((stream) => {
    const facts = analyzeStream({
      url: stream.url,
      referrer: stream.referrer,
      userAgent: stream.user_agent,
    });
    const webPlayable = isWebPlayable(facts, 'unknown', RELAY_ENABLED);
    const geoBlocked = stream.labels?.includes('Geo-blocked') ?? false;
    return {
      id: `${channel.id}-${shortHash(stream.url)}`,
      channelId: channel.id,
      feedId: stream.feed,
      title: stream.title,
      url: stream.url,
      container: facts.container === 'other' ? 'hls' : facts.container,
      quality: stream.quality,
      referrer: stream.referrer,
      userAgent: stream.user_agent,
      labels: stream.labels ?? [],
      isHttps: facts.isHttps,
      webPlayable,
      status: 'unknown' as const,
      score:
        scoreStream({
          webPlayable,
          isHttps: facts.isHttps,
          status: 'unknown',
          container: facts.container,
        }) +
        qualityBonus(stream.quality) -
        (geoBlocked ? 150 : 0),
    };
  });

  const best = streamRows.reduce<(typeof streamRows)[number] | null>(
    (winner, candidate) => (!winner || candidate.score > winner.score ? candidate : winner),
    null,
  );

  const genreSlugs = [
    ...new Set(
      [...channel.categories, ...(input.curated?.categorias ?? [])]
        .map((category) => normalizeTvCategory(category))
        .filter((slug): slug is string => slug !== null),
    ),
  ];

  const languageCodes = [
    ...new Set(input.feeds.flatMap((feed) => feed.languages ?? []).map((code) => code.toLowerCase())),
  ].slice(0, 4);

  return {
    channel: {
      id: channel.id,
      name,
      slug,
      altNames: channel.alt_names ?? [],
      network: channel.network,
      owners: channel.owners ?? [],
      // El sitio curado gana: suele apuntar a la pagina de "en vivo" y no a la portada.
      website: input.curated?.sitio ?? channel.website,
      logoUrl: input.logo?.url ?? null,
      countryCode: location.country,
      subdivisionCode: location.subdivision,
      cityCode: location.city,
      timezone: mainFeed?.timezones?.[0] ?? null,
      isNsfw: channel.is_nsfw || input.blockedReason === 'nsfw',
      blockedReason: input.blockedReason,
      blockedRef: null,
      launchedAt: channel.launched,
      closedAt: channel.closed,
      curated: input.curated !== null,
      // Un canal cerrado se conserva por historia, pero no se ofrece. Un canal
      // curado sin senal propia si se ofrece: se enlaza a su sitio oficial.
      isActive:
        !channel.closed &&
        !input.blockedReason &&
        (streamRows.length > 0 || input.curated?.soloSitioOficial === true),
      bestStreamId: best?.id ?? null,
      webPlayable: best?.webPlayable ?? false,
      updatedAt: new Date(),
    },
    streams: streamRows,
    genres: genreSlugs.map((genreSlug) => ({ channelId: channel.id, genreSlug })),
    languages: languageCodes.map((languageCode) => ({ channelId: channel.id, languageCode })),
  };
}

/**
 * La geografia de un canal sale del `broadcast_area` de su senal principal, de lo
 * mas especifico a lo mas general: ciudad > estado > pais.
 */
function resolveLocation(
  channel: IoChannel,
  feed: IoFeed | null,
  geo: GeoSets,
): { country: string | null; subdivision: string | null; city: string | null } {
  let country = geo.countries.has(channel.country) ? channel.country : null;
  let subdivision: string | null = null;
  let city: string | null = null;

  for (const area of feed?.broadcast_area ?? []) {
    const parsed = parseBroadcastArea(area);
    if (!parsed) continue;
    if (parsed.kind === 'city' && !city) {
      const found = geo.cities.get(parsed.code);
      if (found) {
        city = parsed.code;
        subdivision ??= found.subdivision;
        country ??= found.country;
      }
    } else if (parsed.kind === 'subdivision' && !subdivision) {
      if (geo.subdivisions.has(parsed.code)) {
        subdivision = parsed.code;
        country ??= parsed.code.split('-')[0] ?? null;
      }
    } else if (parsed.kind === 'country' && !country) {
      if (geo.countries.has(parsed.code)) country = parsed.code;
    }
  }

  // Una senal nacional o regional no pertenece a una ciudad concreta.
  const areas = feed?.broadcast_area ?? [];
  if (areas.length > 3) {
    city = null;
    if (areas.some((area) => area.startsWith('r/'))) subdivision = null;
  }

  return { country, subdivision, city };
}

function qualityBonus(quality: string | null): number {
  if (!quality) return 0;
  const height = Number.parseInt(quality.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(height)) return 0;
  // 720p es el punto dulce: se ve bien y no ahoga conexiones modestas.
  if (height >= 1080) return 30;
  if (height >= 720) return 40;
  if (height >= 480) return 20;
  return 5;
}

/** Un logo por canal: el que este en uso, con tamano razonable y sin senal concreta. */
function pickLogos(logos: IoLogo[]): Map<string, IoLogo> {
  const best = new Map<string, IoLogo>();
  for (const logo of logos) {
    if (!logo.url) continue;
    const current = best.get(logo.channel);
    if (!current || logoScore(logo) > logoScore(current)) best.set(logo.channel, logo);
  }
  return best;
}

function logoScore(logo: IoLogo): number {
  let score = 0;
  if (logo.in_use) score += 100;
  if (!logo.feed) score += 20;
  if (/^https:/.test(logo.url)) score += 30;
  if (logo.format === 'PNG' || logo.format === 'SVG') score += 15;
  const width = logo.width ?? 0;
  if (width >= 200 && width <= 800) score += 25;
  else if (width > 800) score += 5;
  return score;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

async function loadGeoSets(): Promise<GeoSets> {
  const db = await getDb();
  const [countryRows, subRows, cityRows] = await Promise.all([
    db.select({ code: countries.code }).from(countries),
    db.select({ code: subdivisions.code, parent: subdivisions.parentCode }).from(subdivisions),
    db
      .select({
        code: cities.code,
        country: cities.countryCode,
        subdivision: cities.subdivisionCode,
      })
      .from(cities),
  ]);
  if (countryRows.length === 0) {
    throw new Error('no hay geografia cargada: ejecuta primero "ingest sync:geo"');
  }
  return {
    countries: new Set(countryRows.map((row) => row.code)),
    subdivisions: new Map(subRows.map((row) => [row.code, row.parent])),
    cities: new Map(cityRows.map((row) => [row.code, { country: row.country, subdivision: row.subdivision }])),
  };
}
