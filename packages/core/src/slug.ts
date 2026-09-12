/** Utilidades de texto compartidas por la ingesta y la web. */

const DIACRITICS = /[\u0300-\u036f]/g;

/** Quita acentos y pasa a minusculas. Base de toda comparacion de texto sucio. */
export function fold(input: string): string {
  return input
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[\u0131]/g, 'i') // i sin punto (turco)
    .replace(/[\u00f8]/g, 'o')
    .replace(/[\u00e6]/g, 'ae')
    .replace(/[\u00df]/g, 'ss')
    .toLowerCase()
    .trim();
}

/** Slug seguro para URLs. Nunca devuelve cadena vacia. */
export function slugify(input: string, fallback = 'sin-nombre'): string {
  const slug = fold(input)
    .replace(/[\u2018\u2019'`]/g, '')
    .replace(/&/g, ' y ')
    .replace(/\+/g, ' mas ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/**
 * Slug estable y unico para una entidad del catalogo: nombre + discriminador corto
 * derivado del id de la fuente. Evita colisiones entre las miles de emisoras
 * llamadas "Radio Maria" sin depender de contadores en la base de datos.
 */
export function entitySlug(name: string, sourceId: string): string {
  return `${slugify(name)}-${shortHash(sourceId)}`;
}

/** Hash FNV-1a de 32 bits en base36. Determinista entre ejecuciones y procesos. */
export function shortHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).padStart(6, '0').slice(0, 6);
}

/** Colapsa espacios y recorta. Muchos nombres vienen con basura de formato. */
export function cleanName(input: string): string {
  return input.replace(/\s+/g, ' ').replace(/^[\s\-|>*]+|[\s\-|<*]+$/g, '').trim();
}
