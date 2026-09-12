/**
 * Cliente de la API de WorldTune, compartido por la web y por las apps móviles.
 *
 * Existe para que Android, iOS y cualquier consumidor futuro hablen con el mismo
 * contrato: si un campo cambia, cambia aquí y rompe la compilación en todas las
 * plataformas a la vez, en vez de fallar en producción en una sola.
 */

export interface Paged<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  nextPage: number | null;
}

export interface StationSummary {
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
  /** Ubicación ya formateada por el servidor ("Guadalajara · Jalisco · México"). */
  place: string | null;
}

export interface ChannelSummary {
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
  place: string | null;
}

export interface CountrySummary {
  code: string;
  name: string;
  nameEs: string | null;
  slug: string;
  flag: string | null;
  regionCode: string | null;
  count: number;
}

export interface GenreSummary {
  slug: string;
  name: string;
  nameEs: string;
  parentSlug: string | null;
  count: number;
}

export interface PlaceSummary {
  code: string;
  name: string;
  slug: string;
  count: number;
}

export interface StationDetail {
  station: StationSummary & { homepage: string | null; rawState: string | null };
  streams: Array<{
    id: string;
    url: string;
    resolvedUrl: string | null;
    container: string;
    bitrate: number | null;
    needsProxy: boolean;
    status: string;
  }>;
  genres: Array<{ slug: string; name: string; nameEs: string }>;
  similar: StationSummary[];
}

export interface ChannelDetail {
  channel: ChannelSummary & { timezone: string | null };
  streams: Array<{
    id: string;
    url: string;
    resolvedUrl: string | null;
    container: string;
    quality: string | null;
    feedId: string | null;
  }>;
  genres: Array<{ slug: string; name: string; nameEs: string }>;
}

/**
 * Resultado de un ranking. `source` viaja siempre con los datos a propósito:
 * 'radio-browser' es audiencia mundial real y 'local' son las reproducciones de
 * esta plataforma. Un cliente no debe poder confundirlas al pintarlas.
 */
export interface Ranking<T> {
  source: 'radio-browser' | 'local';
  /**
   * Qué mide exactamente la cifra: escuchas de las últimas 24 h, votos
   * acumulados, variación frente a ayer, o reproducciones de esta plataforma.
   */
  metric: 'listeners24h' | 'votes' | 'trend' | 'plays';
  data: T[];
}

export interface RankedStation extends StationSummary {
  clickCount: number;
  votes: number;
  clickTrend: number;
  playCount: number;
}

export interface RankedChannel extends ChannelSummary {
  playCount: number;
}

export interface BrowseParams {
  country?: string;
  state?: string;
  city?: string;
  genre?: string;
  language?: string;
  q?: string;
  order?: 'popularity' | 'name' | 'recent';
  page?: number;
  limit?: number;
}

export class WorldTuneApi {
  constructor(
    private readonly baseUrl: string,
    private readonly options: { timeoutMs?: number; userAgent?: string } = {},
  ) {}

  private async get<T>(path: string, params: object = {}): Promise<T> {
    const url = new URL(`/api/v1/${path}`, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    const response = await fetch(url, {
      headers: this.options.userAgent ? { 'User-Agent': this.options.userAgent } : {},
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
    });
    if (!response.ok) {
      throw new ApiError(response.status, `${response.status} en ${path}`);
    }
    return (await response.json()) as T;
  }

  stations(params: BrowseParams = {}): Promise<Paged<StationSummary>> {
    return this.get('stations', params);
  }

  station(slug: string): Promise<StationDetail> {
    return this.get(`stations/${encodeURIComponent(slug)}`);
  }

  channels(params: BrowseParams = {}): Promise<Paged<ChannelSummary>> {
    return this.get('channels', params);
  }

  channel(slug: string): Promise<ChannelDetail> {
    return this.get(`channels/${encodeURIComponent(slug)}`);
  }

  /**
   * Rankings:
   *  - `listening`: escuchas de las últimas 24 h en toda la comunidad de Radio Browser.
   *  - `voted`: votos acumulados (reputación histórica, no audiencia de hoy).
   *  - `trending`: variación de escuchas frente al día anterior.
   *  - `local`: reproducciones de esta plataforma, única fuente para televisión.
   */
  top(
    source: 'listening' | 'voted' | 'trending' | 'local' = 'listening',
    limit = 10,
  ): Promise<{ stations: Ranking<RankedStation>; channels: Ranking<RankedChannel> }> {
    return this.get('top', { source, limit });
  }

  countries(kind: 'radio' | 'tv' = 'radio'): Promise<{ data: CountrySummary[] }> {
    return this.get('countries', { kind });
  }

  country(
    slug: string,
    kind: 'radio' | 'tv' = 'radio',
  ): Promise<{
    country: CountrySummary;
    subdivisions: PlaceSummary[];
    cities: Array<PlaceSummary & { subdivisionCode: string | null }>;
  }> {
    return this.get(`countries/${encodeURIComponent(slug)}`, { kind });
  }

  genres(kind: 'radio' | 'tv' = 'radio'): Promise<{
    data: GenreSummary[];
    languages: Array<{ code: string; name: string; stationCount: number }>;
  }> {
    return this.get('genres', { kind });
  }

  search(query: string, limit = 8): Promise<{
    results: Array<{
      kind: 'station' | 'channel';
      name: string;
      slug: string;
      logoUrl: string | null;
      subtitle: string | null;
    }>;
  }> {
    return this.get('search', { q: query, limit });
  }

  /**
   * Cuenta una reproducción. Para radio además se reenvía a Radio Browser, cuyo
   * ranking mundial se construye con estos reportes; para televisión es la única
   * métrica de audiencia que existe.
   */
  async reportPlay(id: string, kind: 'station' | 'channel' = 'station'): Promise<void> {
    const url = new URL(`/api/v1/click?kind=${kind}&id=${encodeURIComponent(id)}`, this.baseUrl);
    await fetch(url, { method: 'POST' }).catch(() => {});
  }

  async reportBroken(kind: 'station' | 'channel', id: string): Promise<boolean> {
    const url = new URL('/api/v1/report', this.baseUrl);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, id, reason: 'no suena' }),
    }).catch(() => null);
    return response?.ok ?? false;
  }
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * URL que hay que abrir en cada plataforma.
 *
 * Diferencia clave: el navegador bloquea audio http:// dentro de una página
 * https (contenido mixto) y por eso existe el relay. Una app nativa no tiene esa
 * restricción, así que reproduce el origen directamente: menos saltos, menos
 * latencia y ni un byte de ancho de banda nuestro.
 */
export function resolveStreamUrl(
  stream: { streamUrl: string | null; needsProxy: boolean },
  options: { platform: 'web' | 'native'; baseUrl?: string },
): string | null {
  if (!stream.streamUrl) return null;
  if (options.platform === 'native' || !stream.needsProxy) return stream.streamUrl;
  const base = options.baseUrl ?? '';
  return `${base}/api/v1/relay?u=${encodeURIComponent(stream.streamUrl)}`;
}
