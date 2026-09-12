import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/**
 * Esquema unico para radio y television. La jerarquia geografica y las taxonomias
 * se comparten a proposito: es lo que permite una sola pagina "Jalisco" con las
 * emisoras y los canales de Jalisco, en vez de dos arboles paralelos.
 */

// ---------------------------------------------------------------- Geografia

export const countries = pgTable('countries', {
  /** ISO-3166-1 alpha-2. */
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  nameEs: text('name_es'),
  slug: text('slug').notNull(),
  flag: text('flag'),
  /** Codigo de region de iptv-org (LATAM, EU, ...) para agrupaciones amplias. */
  regionCode: text('region_code'),
  stationCount: integer('station_count').notNull().default(0),
  channelCount: integer('channel_count').notNull().default(0),
}, (t) => [uniqueIndex('countries_slug_idx').on(t.slug)]);

export const subdivisions = pgTable('subdivisions', {
  /** ISO-3166-2, p. ej. MX-JAL. */
  code: text('code').primaryKey(),
  countryCode: text('country_code').notNull().references(() => countries.code),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  parentCode: text('parent_code'),
  stationCount: integer('station_count').notNull().default(0),
  channelCount: integer('channel_count').notNull().default(0),
}, (t) => [
  index('subdivisions_country_idx').on(t.countryCode),
  uniqueIndex('subdivisions_country_slug_idx').on(t.countryCode, t.slug),
]);

export const cities = pgTable('cities', {
  /** Codigo de iptv-org, p. ej. MXGDL. */
  code: text('code').primaryKey(),
  countryCode: text('country_code').notNull().references(() => countries.code),
  subdivisionCode: text('subdivision_code'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  stationCount: integer('station_count').notNull().default(0),
  channelCount: integer('channel_count').notNull().default(0),
}, (t) => [
  index('cities_country_idx').on(t.countryCode),
  index('cities_subdivision_idx').on(t.subdivisionCode),
  uniqueIndex('cities_country_slug_idx').on(t.countryCode, t.slug),
]);

export const languages = pgTable('languages', {
  /** ISO-639 (el de iptv-org es 639-3; Radio Browser manda 639-1). */
  code: text('code').primaryKey(),
  name: text('name').notNull(),
  nameEs: text('name_es'),
  slug: text('slug').notNull(),
  stationCount: integer('station_count').notNull().default(0),
}, (t) => [uniqueIndex('languages_slug_idx').on(t.slug)]);

// ---------------------------------------------------------------- Taxonomia

export const genres = pgTable('genres', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  nameEs: text('name_es').notNull(),
  /** radio | tv | both */
  kind: text('kind').notNull(),
  parentSlug: text('parent_slug'),
  stationCount: integer('station_count').notNull().default(0),
  channelCount: integer('channel_count').notNull().default(0),
}, (t) => [index('genres_kind_idx').on(t.kind)]);

/**
 * Tags de Radio Browser que no encajaron en la taxonomia, con su frecuencia.
 * Es la cola de trabajo para ampliar los alias sin adivinar.
 */
export const unknownTags = pgTable('unknown_tags', {
  tag: text('tag').primaryKey(),
  count: integer('count').notNull().default(0),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
});

// ---------------------------------------------------------------- Radio

export const stations = pgTable('stations', {
  /** stationuuid de Radio Browser. */
  id: text('id').primaryKey(),
  source: text('source').notNull().default('radio-browser'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  homepage: text('homepage'),
  logoUrl: text('logo_url'),
  countryCode: text('country_code').references(() => countries.code),
  subdivisionCode: text('subdivision_code'),
  cityCode: text('city_code'),
  /** Texto original del estado: se conserva para poder remapear sin re-ingerir. */
  rawState: text('raw_state'),
  lat: doublePrecision('lat'),
  lon: doublePrecision('lon'),
  codec: text('codec'),
  bitrate: integer('bitrate'),
  /** Reproducciones que cuenta Radio Browser en todo el mundo. Es la audiencia real. */
  clickCount: integer('click_count').notNull().default(0),
  /** Votos de la comunidad: intención, no escucha. */
  votes: integer('votes').notNull().default(0),
  /** Mezcla de ambos para ordenar listados generales. */
  popularity: integer('popularity').notNull().default(0),
  /** Variación de clics en las últimas 24 h: lo que está subiendo ahora. */
  clickTrend: integer('click_trend').notNull().default(0),
  /** Reproducciones contadas por nosotros (esta plataforma). */
  playCount: integer('play_count').notNull().default(0),
  /** Marca de catalogo blanco, para poder publicar en tiendas sin rehacer nada. */
  curated: boolean('curated').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  /** Resumen del mejor stream, desnormalizado para listar sin joins. */
  bestStreamId: text('best_stream_id'),
  webPlayable: boolean('web_playable').notNull().default(false),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('stations_slug_idx').on(t.slug),
  index('stations_country_idx').on(t.countryCode, t.popularity),
  index('stations_subdivision_idx').on(t.subdivisionCode),
  index('stations_city_idx').on(t.cityCode),
  index('stations_popularity_idx').on(t.popularity),
  index('stations_clicks_idx').on(t.clickCount),
  index('stations_plays_idx').on(t.playCount),
  index('stations_playable_idx').on(t.webPlayable, t.isActive),
]);

export const stationStreams = pgTable('station_streams', {
  id: text('id').primaryKey(),
  stationId: text('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  /** URL final tras redirecciones, que es la que se reproduce. */
  resolvedUrl: text('resolved_url'),
  container: text('container').notNull().default('other'),
  contentType: text('content_type'),
  bitrate: integer('bitrate'),
  isHttps: boolean('is_https').notNull().default(false),
  needsProxy: boolean('needs_proxy').notNull().default(false),
  corsAllowed: boolean('cors_allowed').notNull().default(false),
  webPlayable: boolean('web_playable').notNull().default(false),
  /** unknown | ok | cors | timeout | error | gone */
  status: text('status').notNull().default('unknown'),
  latencyMs: integer('latency_ms'),
  failCount: integer('fail_count').notNull().default(0),
  score: real('score').notNull().default(0),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
}, (t) => [
  index('station_streams_station_idx').on(t.stationId),
  index('station_streams_check_idx').on(t.lastCheckedAt),
]);

export const stationGenres = pgTable('station_genres', {
  stationId: text('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  genreSlug: text('genre_slug').notNull().references(() => genres.slug, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.stationId, t.genreSlug] }),
  index('station_genres_genre_idx').on(t.genreSlug),
]);

export const stationLanguages = pgTable('station_languages', {
  stationId: text('station_id').notNull().references(() => stations.id, { onDelete: 'cascade' }),
  languageCode: text('language_code').notNull(),
}, (t) => [
  primaryKey({ columns: [t.stationId, t.languageCode] }),
  index('station_languages_lang_idx').on(t.languageCode),
]);

// ---------------------------------------------------------------- Television

export const channels = pgTable('channels', {
  /** id de iptv-org, p. ej. CanalOnce.mx */
  id: text('id').primaryKey(),
  source: text('source').notNull().default('iptv-org'),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  altNames: text('alt_names').array(),
  network: text('network'),
  owners: text('owners').array(),
  website: text('website'),
  logoUrl: text('logo_url'),
  countryCode: text('country_code').references(() => countries.code),
  subdivisionCode: text('subdivision_code'),
  cityCode: text('city_code'),
  timezone: text('timezone'),
  isNsfw: boolean('is_nsfw').notNull().default(false),
  /** dmca | nsfw | null. Si tiene valor, el canal no se publica jamas. */
  blockedReason: text('blocked_reason'),
  blockedRef: text('blocked_ref'),
  launchedAt: text('launched_at'),
  closedAt: text('closed_at'),
  curated: boolean('curated').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  /**
   * Reproducciones contadas por nosotros. Para television es la UNICA senal de
   * audiencia que existe: iptv-org no publica ningun dato de espectadores, asi
   * que cualquier "top" de TV sale de aqui o es inventado.
   */
  playCount: integer('play_count').notNull().default(0),
  bestStreamId: text('best_stream_id'),
  webPlayable: boolean('web_playable').notNull().default(false),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('channels_slug_idx').on(t.slug),
  index('channels_plays_idx').on(t.playCount),
  index('channels_country_idx').on(t.countryCode),
  index('channels_subdivision_idx').on(t.subdivisionCode),
  index('channels_city_idx').on(t.cityCode),
  index('channels_playable_idx').on(t.webPlayable, t.isActive, t.blockedReason),
]);

export const channelStreams = pgTable('channel_streams', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  feedId: text('feed_id'),
  title: text('title'),
  url: text('url').notNull(),
  resolvedUrl: text('resolved_url'),
  container: text('container').notNull().default('hls'),
  quality: text('quality'),
  /** Cabeceras que exige el origen: si existen, el navegador no puede reproducirlo. */
  referrer: text('referrer'),
  userAgent: text('user_agent'),
  /** Etiquetas de iptv-org: "Not 24/7", "Geo-blocked". */
  labels: text('labels').array(),
  isHttps: boolean('is_https').notNull().default(false),
  corsAllowed: boolean('cors_allowed').notNull().default(false),
  webPlayable: boolean('web_playable').notNull().default(false),
  status: text('status').notNull().default('unknown'),
  latencyMs: integer('latency_ms'),
  failCount: integer('fail_count').notNull().default(0),
  score: real('score').notNull().default(0),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  lastOkAt: timestamp('last_ok_at', { withTimezone: true }),
}, (t) => [
  index('channel_streams_channel_idx').on(t.channelId),
  index('channel_streams_check_idx').on(t.lastCheckedAt),
]);

export const channelGenres = pgTable('channel_genres', {
  channelId: text('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  genreSlug: text('genre_slug').notNull().references(() => genres.slug, { onDelete: 'cascade' }),
}, (t) => [
  primaryKey({ columns: [t.channelId, t.genreSlug] }),
  index('channel_genres_genre_idx').on(t.genreSlug),
]);

export const channelLanguages = pgTable('channel_languages', {
  channelId: text('channel_id').notNull().references(() => channels.id, { onDelete: 'cascade' }),
  languageCode: text('language_code').notNull(),
}, (t) => [
  primaryKey({ columns: [t.channelId, t.languageCode] }),
  index('channel_languages_lang_idx').on(t.languageCode),
]);

// ---------------------------------------------------------------- Operacion

export const ingestRuns = pgTable('ingest_runs', {
  id: text('id').primaryKey(),
  task: text('task').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  inserted: integer('inserted').notNull().default(0),
  updated: integer('updated').notNull().default(0),
  deactivated: integer('deactivated').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  notes: text('notes'),
}, (t) => [index('ingest_runs_task_idx').on(t.task, t.startedAt)]);

/**
 * Reproducciones propias por dia. Se guarda un contador por elemento y dia, no
 * un evento por reproduccion: basta para un top semanal y la tabla se mantiene
 * pequena (solo aparece lo que alguien ha puesto de verdad).
 */
export const playStats = pgTable('play_stats', {
  /** station | channel */
  kind: text('kind').notNull(),
  targetId: text('target_id').notNull(),
  /** Fecha en UTC, formato YYYY-MM-DD. */
  day: text('day').notNull(),
  count: integer('count').notNull().default(0),
}, (t) => [
  primaryKey({ columns: [t.kind, t.targetId, t.day] }),
  index('play_stats_day_idx').on(t.day, t.count),
]);

/** Reportes de enlaces caidos enviados por los usuarios. */
export const streamReports = pgTable('stream_reports', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull(), // station | channel
  targetId: text('target_id').notNull(),
  reason: text('reason'),
  clientHash: text('client_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, (t) => [index('stream_reports_target_idx').on(t.kind, t.targetId)]);

export type Station = typeof stations.$inferSelect;
export type StationInsert = typeof stations.$inferInsert;
export type StationStream = typeof stationStreams.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type ChannelInsert = typeof channels.$inferInsert;
export type ChannelStream = typeof channelStreams.$inferSelect;
export type Country = typeof countries.$inferSelect;
export type Subdivision = typeof subdivisions.$inferSelect;
export type City = typeof cities.$inferSelect;
export type Genre = typeof genres.$inferSelect;
