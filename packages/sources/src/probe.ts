import type { Container, StreamStatus } from '@worldtune/core';
import { detectContainer } from '@worldtune/core';
import { USER_AGENT } from './http';

/**
 * Verificador de streams. Un directorio de radio y TV vive o muere por esto:
 * la mitad de las URLs publicas estan caidas, sirven http en una web https o no
 * envian cabeceras CORS, y sin comprobarlo el usuario se come el fallo.
 */

export interface ProbeResult {
  status: StreamStatus;
  httpStatus: number | null;
  /** URL tras seguir redirecciones: a veces cambia de http a https o al contrario. */
  finalUrl: string;
  contentType: string | null;
  /** true si el navegador podra leer los bytes desde JS (hls.js, mpegts.js). */
  corsAllowed: boolean;
  latencyMs: number;
  container: Container;
  /** Titulo que anuncia el servidor Icecast/Shoutcast, si lo hay. */
  icyName: string | null;
  bitrate: number | null;
  error: string | null;
}

const CONTENT_TYPE_MAP: Array<[RegExp, Container]> = [
  [/mpegurl|m3u8/i, 'hls'],
  [/dash\+xml/i, 'dash'],
  [/mp2t|mpeg-?ts/i, 'mpegts'],
  [/audio\/mpeg|audio\/mp3/i, 'mp3'],
  [/aacp?|audio\/mp4|audio\/x-m4a/i, 'aac'],
  [/ogg|opus/i, 'ogg'],
  [/flac/i, 'flac'],
];

/**
 * Pide los primeros bytes y corta. No se puede usar HEAD: muchos Icecast lo
 * responden con 405 aunque el stream funcione perfectamente.
 */
export async function probeStream(
  url: string,
  options: { timeoutMs?: number; declaredCodec?: string | null } = {},
): Promise<ProbeResult> {
  const timeoutMs = options.timeoutMs ?? 12_000;
  const started = Date.now();
  // Mismo motivo que en fetchJson: el temporizador propio genera rechazos
  // huerfanos cuando la respuesta ya se cerro.
  const signal = AbortSignal.timeout(timeoutMs);

  const base: ProbeResult = {
    status: 'unknown',
    httpStatus: null,
    finalUrl: url,
    contentType: null,
    corsAllowed: false,
    latencyMs: 0,
    container: detectContainer(url, options.declaredCodec),
    icyName: null,
    bitrate: null,
    error: null,
  };

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal,
      headers: {
        'User-Agent': USER_AGENT,
        // Provoca que Icecast/Shoutcast anuncien sus metadatos en las cabeceras.
        'Icy-MetaData': '1',
        Range: 'bytes=0-8191',
        // Simula el origen del navegador para que el servidor decida el ACAO real.
        Origin: process.env.PROBE_ORIGIN ?? 'https://worldtune.app',
      },
    });

    const latencyMs = Date.now() - started;
    const contentType = response.headers.get('content-type');
    const acao = response.headers.get('access-control-allow-origin');
    const icyName = response.headers.get('icy-name');
    const icyBr = response.headers.get('icy-br');

    // Cerrar el cuerpo de inmediato: son flujos infinitos.
    await response.body?.cancel().catch(() => {});

    const result: ProbeResult = {
      ...base,
      httpStatus: response.status,
      finalUrl: response.url || url,
      contentType,
      corsAllowed: acao === '*' || (acao !== null && acao !== ''),
      latencyMs,
      container: matchContentType(contentType) ?? base.container,
      icyName: icyName?.trim() || null,
      bitrate: icyBr ? Number.parseInt(icyBr.split(',')[0]!, 10) || null : null,
    };

    if (response.status === 404 || response.status === 410) return { ...result, status: 'gone' };
    if (!response.ok && response.status !== 206) {
      return { ...result, status: 'error', error: `HTTP ${response.status}` };
    }
    // Un HTML en vez de audio significa portal, captcha o pagina de error.
    if (contentType && /text\/html/i.test(contentType)) {
      return { ...result, status: 'error', error: 'devuelve HTML, no un stream' };
    }
    return { ...result, status: result.corsAllowed ? 'ok' : 'cors' };
  } catch (error) {
    const latencyMs = Date.now() - started;
    const message = error instanceof Error ? error.message : String(error);
    const aborted = signal.aborted || /abort|timeout/i.test(message);
    return {
      ...base,
      latencyMs,
      status: aborted ? 'timeout' : 'error',
      error: message.slice(0, 200),
    };
  }
}

function matchContentType(contentType: string | null): Container | null {
  if (!contentType) return null;
  for (const [re, container] of CONTENT_TYPE_MAP) if (re.test(contentType)) return container;
  return null;
}

/** Ejecuta varias comprobaciones a la vez con un limite de concurrencia. */
export async function probeMany(
  urls: Array<{ id: string; url: string; codec?: string | null }>,
  options: { concurrency?: number; timeoutMs?: number; onResult?: (id: string, result: ProbeResult) => void } = {},
): Promise<Map<string, ProbeResult>> {
  const concurrency = options.concurrency ?? 16;
  const results = new Map<string, ProbeResult>();
  let index = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const current = index++;
      const item = urls[current];
      if (!item) return;
      const result = await probeStream(item.url, {
        timeoutMs: options.timeoutMs,
        declaredCodec: item.codec,
      });
      results.set(item.id, result);
      options.onResult?.(item.id, result);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
  return results;
}
