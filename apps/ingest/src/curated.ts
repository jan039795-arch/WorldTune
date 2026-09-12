import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

/**
 * Catálogo curado a mano (data/canales-curados.json).
 *
 * Resuelve el hueco que deja la ingesta automática: iptv-org conoce canales
 * grandes (Canal Once, Azteca 7) pero no tiene señal para ellos, y sin señal la
 * sincronización los descarta. Aquí se añade la URL que el propio canal publica,
 * o se marca que solo se puede ver en su sitio.
 */

export interface CuratedStream {
  url: string;
  quality?: string;
  title?: string;
}

export interface CuratedChannel {
  /** Identificador de iptv-org, p. ej. CanalOnce.mx */
  id: string;
  nota?: string;
  verificadoEl?: string;
  categorias?: string[];
  streams?: CuratedStream[];
  /** El canal existe y emite, pero no se puede incrustar: se enlaza su web. */
  soloSitioOficial?: boolean;
  sitio?: string;
  /** Datos completos para canales que ni siquiera están en iptv-org. */
  definicion?: {
    name: string;
    country: string;
    website?: string;
    logo?: string;
    network?: string;
  };
}

/** La ruta se resuelve desde el módulo, no desde cwd: el cron no sabe dónde está. */
const CURATED_PATH = fileURLToPath(new URL('../../../data/canales-curados.json', import.meta.url));

export async function loadCuratedChannels(): Promise<CuratedChannel[]> {
  try {
    const raw = await readFile(CURATED_PATH, 'utf8');
    const parsed = JSON.parse(raw) as { canales?: CuratedChannel[] };
    return (parsed.canales ?? []).filter((channel) => Boolean(channel.id));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}
