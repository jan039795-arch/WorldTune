import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const USER_AGENT = process.env.USER_AGENT ?? 'WorldTune/0.1';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} en ${url}`);
    this.name = 'HttpError';
  }
}

export interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * GET con timeout, reintentos y backoff exponencial. Todas las fuentes son APIs
 * publicas y gratuitas: si fallan hay que insistir con calma, no martillear.
 */
export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { timeoutMs = 20_000, retries = 3, headers = {} } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(Math.min(1000 * 2 ** (attempt - 1), 8000));
    // AbortSignal.timeout en lugar de un AbortController con setTimeout: el
    // temporizador manual puede disparar despues de que nadie espere ya la
    // promesa del fetch, y ese rechazo sin dueno tumba el proceso entero.
    const signal = options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', ...headers },
        signal,
      });
      if (!response.ok) {
        // Un cuerpo sin leer deja la conexion colgada y, cuando el temporizador
        // vence mas tarde, produce un rechazo sin dueno que tumba el proceso.
        // Se cierra SIEMPRE, incluso antes de lanzar un error.
        await response.body?.cancel().catch(() => {});
        // 4xx (salvo 429) no se arregla reintentando.
        if (response.status < 500 && response.status !== 429) {
          throw new HttpError(response.status, url);
        }
        lastError = new HttpError(response.status, url);
        continue;
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      lastError = error;
    }
  }
  throw lastError ?? new Error(`No se pudo obtener ${url}`);
}

const CACHE_DIR = process.env.SOURCE_CACHE_DIR ?? join(process.cwd(), 'data', 'cache');

/**
 * Igual que fetchJson pero con cache en disco. Los volcados de iptv-org pesan
 * decenas de MB y cambian una vez al dia: no hace falta bajarlos en cada prueba.
 */
export async function fetchJsonCached<T>(
  url: string,
  cacheKey: string,
  maxAgeMs = 6 * 60 * 60 * 1000,
  options: FetchOptions = {},
): Promise<T> {
  const path = join(CACHE_DIR, `${cacheKey}.json`);
  try {
    const info = await stat(path);
    if (Date.now() - info.mtimeMs < maxAgeMs) {
      return JSON.parse(await readFile(path, 'utf8')) as T;
    }
  } catch {
    // sin cache: se descarga
  }
  const data = await fetchJson<T>(url, options);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data), 'utf8');
  return data;
}
