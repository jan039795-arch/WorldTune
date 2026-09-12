import { promises as dns } from 'node:dns';
import { fetchJson, USER_AGENT, type FetchOptions } from './http';

/**
 * Cliente de Radio Browser (https://api.radio-browser.info).
 *
 * Dos reglas de la casa que hay que respetar:
 *  1. No fijar un mirror en el codigo: se descubren por DNS y se rota.
 *  2. Enviar un User-Agent propio e identificable.
 */

export interface RbStation {
  stationuuid: string;
  changeuuid: string;
  name: string;
  url: string;
  url_resolved: string;
  homepage: string;
  favicon: string;
  tags: string;
  country: string;
  countrycode: string;
  iso_3166_2: string | null;
  state: string;
  language: string;
  languagecodes: string;
  votes: number;
  codec: string;
  bitrate: number;
  hls: number;
  lastcheckok: number;
  lastchecktime_iso8601: string | null;
  lastchangetime_iso8601: string | null;
  clickcount: number;
  clicktrend: number;
  ssl_error: number;
  geo_lat: number | null;
  geo_long: number | null;
}

export interface RbCountry {
  name: string;
  iso_3166_1: string;
  stationcount: number;
}

export interface RbNamed {
  name: string;
  stationcount: number;
}

export interface RbStats {
  stations: number;
  stations_broken: number;
  tags: number;
  languages: number;
  countries: number;
  software_version: string;
  status: string;
}

const FALLBACK_SERVERS = [
  'https://de1.api.radio-browser.info',
  'https://de2.api.radio-browser.info',
  'https://at1.api.radio-browser.info',
];

export class RadioBrowserClient {
  private servers: string[] = [];
  private cursor = 0;

  constructor(private readonly options: { timeoutMs?: number } = {}) {}

  /**
   * Descubre los mirrors por SRV y, si falla, por A + reverse DNS. La lista se
   * aleatoriza para repartir la carga entre voluntarios.
   */
  async discover(): Promise<string[]> {
    if (this.servers.length > 0) return this.servers;
    const names = new Set<string>();

    try {
      const srv = await dns.resolveSrv('_api._tcp.radio-browser.info');
      for (const record of srv) names.add(record.name);
    } catch {
      // sin SRV: se intenta por direcciones
    }

    if (names.size === 0) {
      try {
        const addresses = await dns.resolve4('all.api.radio-browser.info');
        for (const address of addresses) {
          try {
            const [hostname] = await dns.reverse(address);
            if (hostname) names.add(hostname);
          } catch {
            // sin PTR no se puede usar https con ese host
          }
        }
      } catch {
        // sin DNS: quedan los de reserva
      }
    }

    const discovered = [...names].map((name) => `https://${name}`);
    this.servers = shuffle(discovered.length > 0 ? discovered : FALLBACK_SERVERS);
    return this.servers;
  }

  /** GET a un endpoint, rotando de mirror ante cada fallo. */
  async get<T>(path: string, options: FetchOptions = {}): Promise<T> {
    const servers = await this.discover();
    let lastError: unknown;
    for (let i = 0; i < servers.length; i++) {
      const base = servers[(this.cursor + i) % servers.length]!;
      try {
        const result = await fetchJson<T>(`${base}${path}`, {
          retries: 1,
          timeoutMs: this.options.timeoutMs ?? 25_000,
          ...options,
        });
        this.cursor = (this.cursor + i) % servers.length; // el que funciona se queda
        return result;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error(`Ningun mirror de Radio Browser respondio a ${path}`);
  }

  stats(): Promise<RbStats> {
    return this.get<RbStats>('/json/stats');
  }

  countries(): Promise<RbCountry[]> {
    return this.get<RbCountry[]>('/json/countries?order=name&hidebroken=true');
  }

  languages(): Promise<RbNamed[]> {
    return this.get<RbNamed[]>('/json/languages?order=stationcount&reverse=true&hidebroken=true');
  }

  tags(limit = 500): Promise<RbNamed[]> {
    return this.get<RbNamed[]>(`/json/tags?order=stationcount&reverse=true&limit=${limit}`);
  }

  /**
   * Recorre el catalogo completo por paginas. Se ordena por `changeuuid` porque
   * es estable mientras se pagina: ordenar por clickcount hace que las filas
   * salten de pagina entre peticiones y se pierdan emisoras.
   */
  async *stations(options: {
    countryCode?: string;
    pageSize?: number;
    limit?: number;
    hideBroken?: boolean;
    /** Desde que fila continuar: permite reanudar una sincronizacion cortada. */
    offset?: number;
  } = {}): AsyncGenerator<RbStation[]> {
    const pageSize = Math.min(options.pageSize ?? 1000, 10_000);
    const hideBroken = options.hideBroken ?? true;
    let offset = options.offset ?? 0;
    let yielded = 0;

    for (;;) {
      const params = new URLSearchParams({
        order: 'changeuuid',
        reverse: 'false',
        hidebroken: String(hideBroken),
        limit: String(pageSize),
        offset: String(offset),
      });
      if (options.countryCode) params.set('countrycode', options.countryCode.toUpperCase());

      const page = await this.get<RbStation[]>(`/json/stations/search?${params.toString()}`);
      if (page.length === 0) return;

      const slice =
        options.limit !== undefined && yielded + page.length > options.limit
          ? page.slice(0, options.limit - yielded)
          : page;
      yield slice;
      yielded += slice.length;

      if (options.limit !== undefined && yielded >= options.limit) return;
      if (page.length < pageSize) return;
      offset += pageSize;
    }
  }

  /**
   * Reporta una reproduccion. Es como Radio Browser mide popularidad; usar el
   * catalogo sin devolver esta senal es vivir del trabajo ajeno.
   */
  async reportClick(stationUuid: string): Promise<void> {
    await this.get(`/json/url/${stationUuid}`, { retries: 0, timeoutMs: 5000 }).catch(() => {
      // el reporte es best effort, nunca debe romper la reproduccion
    });
  }

  get userAgent(): string {
    return USER_AGENT;
  }
}

function shuffle<T>(input: T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
