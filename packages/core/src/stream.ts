/**
 * Clasificacion de streams. Decide con que reproductor se puede abrir cada URL
 * y si el navegador podra hacerlo, que es la diferencia entre una ficha que
 * suena y una que frustra al usuario.
 */

export type Container = 'hls' | 'dash' | 'mpegts' | 'mp3' | 'aac' | 'ogg' | 'flac' | 'other';

export type StreamStatus = 'unknown' | 'ok' | 'cors' | 'timeout' | 'error' | 'gone';

export interface StreamFacts {
  container: Container;
  isHttps: boolean;
  /** Solo http: en una pagina https hay que pasar por el relay o no suena. */
  needsProxy: boolean;
  /** Cabeceras que el navegador no permite fijar desde JS. */
  requiresForbiddenHeaders: boolean;
}

const EXT_MAP: Array<[RegExp, Container]> = [
  [/\.m3u8?(\?|$|;)/i, 'hls'],
  [/\.mpd(\?|$|;)/i, 'dash'],
  [/\.ts(\?|$|;)/i, 'mpegts'],
  [/\.mp3(\?|$|;)/i, 'mp3'],
  [/\.(aac|m4a)(\?|$|;)/i, 'aac'],
  [/\.(ogg|opus)(\?|$|;)/i, 'ogg'],
  [/\.flac(\?|$|;)/i, 'flac'],
];

/** Deduce el contenedor por extension y, si no la hay, por el codec declarado. */
export function detectContainer(url: string, codec?: string | null, hls?: boolean): Container {
  if (hls) return 'hls';
  for (const [re, container] of EXT_MAP) if (re.test(url)) return container;
  switch ((codec ?? '').toUpperCase()) {
    case 'MP3':
      return 'mp3';
    case 'AAC':
    case 'AAC+':
    case 'AACP':
      return 'aac';
    case 'OGG':
    case 'VORBIS':
    case 'OPUS':
      return 'ogg';
    case 'FLAC':
      return 'flac';
    default:
      // Icecast y Shoutcast suelen servir /stream sin extension: se resuelve
      // por Content-Type en el health check.
      return 'other';
  }
}

export function analyzeStream(input: {
  url: string;
  codec?: string | null;
  hls?: boolean;
  referrer?: string | null;
  userAgent?: string | null;
}): StreamFacts {
  const isHttps = input.url.startsWith('https://');
  return {
    container: detectContainer(input.url, input.codec, input.hls),
    isHttps,
    needsProxy: !isHttps,
    requiresForbiddenHeaders: Boolean(input.referrer || input.userAgent),
  };
}

/** Contenedores que un navegador moderno puede reproducir (con hls.js/mpegts.js). */
const BROWSER_CONTAINERS: ReadonlySet<Container> = new Set<Container>([
  'hls',
  'dash',
  'mpegts',
  'mp3',
  'aac',
  'ogg',
  'flac',
  'other',
]);

/**
 * Un stream es reproducible en web si el contenedor es soportado, no exige
 * cabeceras prohibidas y (o es https, o tenemos relay para pasarlo a https).
 * El resultado del health check manda sobre todo lo demas.
 */
export function isWebPlayable(
  facts: StreamFacts,
  status: StreamStatus,
  relayEnabled: boolean,
): boolean {
  if (facts.requiresForbiddenHeaders) return false;
  if (!BROWSER_CONTAINERS.has(facts.container)) return false;
  if (status === 'error' || status === 'gone' || status === 'timeout') return false;
  // 'cors' solo bloquea cuando el reproductor necesita leer los bytes por JS
  // (hls.js, dash.js, mpegts.js). Un <audio src> directo no lo sufre.
  if (status === 'cors' && facts.container !== 'mp3' && facts.container !== 'aac' && facts.container !== 'ogg') {
    return false;
  }
  if (facts.needsProxy && !relayEnabled) return false;
  return true;
}

/** Orden de preferencia al elegir que stream ofrecer de los varios de una emisora. */
export function scoreStream(input: {
  webPlayable: boolean;
  isHttps: boolean;
  status: StreamStatus;
  bitrate?: number | null;
  container: Container;
}): number {
  let score = 0;
  if (input.webPlayable) score += 1000;
  if (input.status === 'ok') score += 300;
  if (input.isHttps) score += 200;
  if (input.container === 'hls') score += 40;
  if (input.container === 'aac') score += 30;
  if (input.container === 'mp3') score += 20;
  // Un bitrate razonable gana; los de 320k gastan datos sin mejorar mucho la voz.
  const bitrate = input.bitrate ?? 0;
  if (bitrate >= 64 && bitrate <= 192) score += 25;
  else if (bitrate > 192) score += 10;
  return score;
}
