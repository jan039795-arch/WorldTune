import { and, asc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { analyzeStream, isWebPlayable, scoreStream, type StreamStatus } from '@worldtune/core';
import { channelStreams, channels, getDb, stationStreams, stations } from '@worldtune/db';
import { probeMany, type ProbeResult } from '@worldtune/sources';
import { log, newCounters, type RunCounters } from './log';
import { chunk } from './util';

/**
 * Verifica streams contra la realidad. Es la diferencia entre un directorio que
 * suena y una lista de enlaces muertos: se comprueba que responden, que no
 * devuelven HTML, y si envian CORS (sin el, hls.js no puede leerlos).
 *
 * El resultado manda sobre la estimacion optimista que hace la ingesta.
 */

const RELAY_ENABLED = process.env.NEXT_PUBLIC_RELAY_ENABLED !== 'false';

export interface CheckOptions {
  kind?: 'radio' | 'tv' | 'both';
  limit?: number;
  concurrency?: number;
  timeoutMs?: number;
  /** Solo se revisan streams sin comprobar o comprobados hace mas de N horas. */
  staleHours?: number;
}

export async function checkStreams(options: CheckOptions = {}): Promise<RunCounters> {
  const counters = newCounters();
  const kind = options.kind ?? 'both';
  const limit = options.limit ?? 500;
  const cutoff = new Date(Date.now() - (options.staleHours ?? 6) * 3600_000);

  if (kind === 'radio' || kind === 'both') {
    await checkRadio({ ...options, limit, cutoff }, counters);
  }
  if (kind === 'tv' || kind === 'both') {
    await checkTv({ ...options, limit, cutoff }, counters);
  }
  return counters;
}

async function checkRadio(
  options: CheckOptions & { limit: number; cutoff: Date },
  counters: RunCounters,
): Promise<void> {
  const db = await getDb();

  // Se priorizan las emisoras populares: son las que la gente abre primero.
  const candidates = await db
    .select({
      id: stationStreams.id,
      stationId: stationStreams.stationId,
      url: stationStreams.url,
      codec: stations.codec,
      failCount: stationStreams.failCount,
    })
    .from(stationStreams)
    .innerJoin(stations, eq(stations.id, stationStreams.stationId))
    .where(
      and(
        eq(stations.isActive, true),
        or(isNull(stationStreams.lastCheckedAt), lt(stationStreams.lastCheckedAt, options.cutoff)),
      ),
    )
    .orderBy(sql`${stations.popularity} desc`, asc(stationStreams.lastCheckedAt))
    .limit(options.limit);

  if (candidates.length === 0) {
    log.info('radio: no hay streams pendientes de revisar');
    return;
  }
  log.info(`radio: comprobando ${candidates.length} streams`);

  const tally = emptyTally();
  let done = 0;
  const results = await probeMany(
    candidates.map((row) => ({ id: row.id, url: row.url, codec: row.codec })),
    {
      concurrency: options.concurrency ?? 16,
      timeoutMs: options.timeoutMs ?? 12_000,
      onResult: (_id, result) => {
        tally[result.status] = (tally[result.status] ?? 0) + 1;
        log.progress(++done, candidates.length, 'radio');
      },
    },
  );
  log.done(`radio comprobada: ${formatTally(tally)}`);

  const byId = new Map(candidates.map((row) => [row.id, row]));
  for (const batch of chunk([...results.entries()], 100)) {
    for (const [id, result] of batch) {
      const row = byId.get(id);
      if (!row) continue;
      const update = buildStreamUpdate(row.url, result, row.failCount, RELAY_ENABLED, row.codec);
      await db.update(stationStreams).set(update).where(eq(stationStreams.id, id));
      if (result.status === 'ok' || result.status === 'cors') counters.updated++;
      else counters.errors++;
    }
  }

  await refreshStationBest([...new Set(candidates.map((row) => row.stationId))]);
}

async function checkTv(
  options: CheckOptions & { limit: number; cutoff: Date },
  counters: RunCounters,
): Promise<void> {
  const db = await getDb();

  const candidates = await db
    .select({
      id: channelStreams.id,
      channelId: channelStreams.channelId,
      url: channelStreams.url,
      referrer: channelStreams.referrer,
      userAgent: channelStreams.userAgent,
      quality: channelStreams.quality,
      failCount: channelStreams.failCount,
    })
    .from(channelStreams)
    .innerJoin(channels, eq(channels.id, channelStreams.channelId))
    .where(
      and(
        eq(channels.isActive, true),
        sql`${channels.blockedReason} is null`,
        or(isNull(channelStreams.lastCheckedAt), lt(channelStreams.lastCheckedAt, options.cutoff)),
      ),
    )
    .orderBy(asc(channelStreams.lastCheckedAt))
    .limit(options.limit);

  if (candidates.length === 0) {
    log.info('tv: no hay streams pendientes de revisar');
    return;
  }
  log.info(`tv: comprobando ${candidates.length} streams`);

  const tally = emptyTally();
  let done = 0;
  const results = await probeMany(
    candidates.map((row) => ({ id: row.id, url: row.url })),
    {
      concurrency: options.concurrency ?? 10,
      timeoutMs: options.timeoutMs ?? 15_000,
      onResult: (_id, result) => {
        tally[result.status] = (tally[result.status] ?? 0) + 1;
        log.progress(++done, candidates.length, 'tv');
      },
    },
  );
  log.done(`tv comprobada: ${formatTally(tally)}`);

  const byId = new Map(candidates.map((row) => [row.id, row]));
  for (const [id, result] of results) {
    const row = byId.get(id);
    if (!row) continue;
    const facts = analyzeStream({
      url: row.url,
      referrer: row.referrer,
      userAgent: row.userAgent,
    });
    const webPlayable = isWebPlayable({ ...facts, container: result.container }, result.status, false);
    await db
      .update(channelStreams)
      .set({
        resolvedUrl: result.finalUrl !== row.url ? result.finalUrl : null,
        container: result.container === 'other' ? 'hls' : result.container,
        isHttps: facts.isHttps,
        corsAllowed: result.corsAllowed,
        webPlayable,
        status: result.status,
        latencyMs: result.latencyMs,
        failCount: result.status === 'ok' || result.status === 'cors' ? 0 : row.failCount + 1,
        lastCheckedAt: new Date(),
        ...(result.status === 'ok' ? { lastOkAt: new Date() } : {}),
        score:
          scoreStream({
            webPlayable,
            isHttps: facts.isHttps,
            status: result.status,
            container: result.container,
          }) + qualityBonus(row.quality),
      })
      .where(eq(channelStreams.id, id));
    if (webPlayable) counters.updated++;
    else counters.errors++;
  }

  await refreshChannelBest([...new Set(candidates.map((row) => row.channelId))]);
}

function buildStreamUpdate(
  url: string,
  result: ProbeResult,
  failCount: number,
  relayEnabled: boolean,
  codec: string | null,
) {
  const facts = analyzeStream({ url, codec });
  const webPlayable = isWebPlayable(
    { ...facts, container: result.container },
    result.status,
    relayEnabled,
  );
  const healthy = result.status === 'ok' || result.status === 'cors';
  return {
    resolvedUrl: result.finalUrl !== url ? result.finalUrl : null,
    container: result.container,
    contentType: result.contentType,
    bitrate: result.bitrate,
    isHttps: facts.isHttps,
    // La URL final puede cambiar de esquema: lo que manda es donde se acaba.
    needsProxy: !result.finalUrl.startsWith('https://'),
    corsAllowed: result.corsAllowed,
    webPlayable,
    status: result.status,
    latencyMs: result.latencyMs,
    failCount: healthy ? 0 : failCount + 1,
    lastCheckedAt: new Date(),
    ...(result.status === 'ok' ? { lastOkAt: new Date() } : {}),
    score: scoreStream({
      webPlayable,
      isHttps: facts.isHttps,
      status: result.status,
      bitrate: result.bitrate,
      container: result.container,
    }),
  };
}

/** Recalcula el mejor stream de cada emisora tocada y propaga si es reproducible. */
async function refreshStationBest(stationIds: string[]): Promise<void> {
  const db = await getDb();
  for (const batch of chunk(stationIds, 200)) {
    const rows = await db
      .select({
        id: stationStreams.id,
        stationId: stationStreams.stationId,
        score: stationStreams.score,
        webPlayable: stationStreams.webPlayable,
      })
      .from(stationStreams)
      .where(inArray(stationStreams.stationId, batch));

    const best = new Map<string, { id: string; score: number; webPlayable: boolean }>();
    for (const row of rows) {
      const current = best.get(row.stationId);
      if (!current || row.score > current.score) {
        best.set(row.stationId, { id: row.id, score: row.score, webPlayable: row.webPlayable });
      }
    }
    for (const [stationId, winner] of best) {
      await db
        .update(stations)
        .set({
          bestStreamId: winner.id,
          webPlayable: winner.webPlayable,
          lastCheckedAt: new Date(),
        })
        .where(eq(stations.id, stationId));
    }
  }
}

async function refreshChannelBest(channelIds: string[]): Promise<void> {
  const db = await getDb();
  for (const batch of chunk(channelIds, 200)) {
    const rows = await db
      .select({
        id: channelStreams.id,
        channelId: channelStreams.channelId,
        score: channelStreams.score,
        webPlayable: channelStreams.webPlayable,
      })
      .from(channelStreams)
      .where(inArray(channelStreams.channelId, batch));

    const best = new Map<string, { id: string; score: number; webPlayable: boolean }>();
    for (const row of rows) {
      const current = best.get(row.channelId);
      if (!current || row.score > current.score) {
        best.set(row.channelId, { id: row.id, score: row.score, webPlayable: row.webPlayable });
      }
    }
    for (const [channelId, winner] of best) {
      await db
        .update(channels)
        .set({
          bestStreamId: winner.id,
          webPlayable: winner.webPlayable,
          lastCheckedAt: new Date(),
        })
        .where(eq(channels.id, channelId));
    }
  }
}

function qualityBonus(quality: string | null): number {
  if (!quality) return 0;
  const height = Number.parseInt(quality.replace(/[^0-9]/g, ''), 10);
  if (!Number.isFinite(height)) return 0;
  if (height >= 1080) return 30;
  if (height >= 720) return 40;
  if (height >= 480) return 20;
  return 5;
}

function emptyTally(): Record<StreamStatus, number> {
  return { unknown: 0, ok: 0, cors: 0, timeout: 0, error: 0, gone: 0 };
}

function formatTally(tally: Record<StreamStatus, number>): string {
  const total = Object.values(tally).reduce((sum, value) => sum + value, 0) || 1;
  const playable = tally.ok + tally.cors;
  return [
    `ok ${tally.ok}`,
    `sin cors ${tally.cors}`,
    `timeout ${tally.timeout}`,
    `error ${tally.error}`,
    `caido ${tally.gone}`,
    `-> responden ${Math.round((playable / total) * 100)}%`,
  ].join(', ');
}
