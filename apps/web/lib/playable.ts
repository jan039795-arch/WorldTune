/** Modelo comun de "algo que se puede reproducir", compartido por radio y TV. */

export interface Playable {
  kind: 'station' | 'channel';
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  /** Linea secundaria: pais, ciudad o cadena. */
  subtitle?: string | null;
  streamUrl: string;
  container: string;
  needsProxy: boolean;
}

/**
 * Devuelve la URL que el navegador debe abrir.
 *
 * Los Icecast que solo sirven http no se pueden reproducir desde una pagina
 * https (contenido mixto), asi que pasan por el relay propio. Es la unica razon
 * por la que existe ese proxy: no se usa para video ajeno.
 */
export function playUrl(item: Pick<Playable, 'streamUrl' | 'needsProxy' | 'kind'>): string {
  if (!item.needsProxy || item.kind === 'channel') return item.streamUrl;
  return `/api/v1/relay?u=${encodeURIComponent(item.streamUrl)}`;
}

export function isHlsLike(container: string | null | undefined): boolean {
  return container === 'hls' || container === 'dash' || container === 'mpegts';
}
