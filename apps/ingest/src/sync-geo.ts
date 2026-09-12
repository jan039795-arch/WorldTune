import { sql } from 'drizzle-orm';
import { GENRES, slugify } from '@worldtune/core';
import { cities, countries, genres, getDb, languages, subdivisions } from '@worldtune/db';
import { iptvOrg } from '@worldtune/sources';
import { log, newCounters, type RunCounters } from './log';
import { chunk } from './util';

/**
 * Carga la columna vertebral del catalogo: paises, estados, ciudades, idiomas y
 * la taxonomia de generos.
 *
 * La geografia sale de iptv-org y no de GeoNames porque ya viene con codigos
 * ISO-3166-1/2 y con la relacion ciudad -> estado -> pais resuelta, que es
 * exactamente la jerarquia que navega la web. Radio Browser, que entrega el
 * estado como texto libre, se casa luego contra estas tablas.
 */

const NAMES_ES: Record<string, string> = {
  MX: 'México', US: 'Estados Unidos', ES: 'España', AR: 'Argentina', CO: 'Colombia',
  CL: 'Chile', PE: 'Perú', BR: 'Brasil', VE: 'Venezuela', EC: 'Ecuador', GT: 'Guatemala',
  BO: 'Bolivia', UY: 'Uruguay', PY: 'Paraguay', CU: 'Cuba', DO: 'República Dominicana',
  PR: 'Puerto Rico', CR: 'Costa Rica', PA: 'Panamá', HN: 'Honduras', SV: 'El Salvador',
  NI: 'Nicaragua', FR: 'Francia', DE: 'Alemania', IT: 'Italia', GB: 'Reino Unido',
  PT: 'Portugal', NL: 'Países Bajos', BE: 'Bélgica', CH: 'Suiza', AT: 'Austria',
  SE: 'Suecia', NO: 'Noruega', DK: 'Dinamarca', FI: 'Finlandia', PL: 'Polonia',
  RU: 'Rusia', UA: 'Ucrania', TR: 'Turquía', GR: 'Grecia', IL: 'Israel', EG: 'Egipto',
  MA: 'Marruecos', ZA: 'Sudáfrica', NG: 'Nigeria', KE: 'Kenia', IN: 'India',
  CN: 'China', JP: 'Japón', KR: 'Corea del Sur', TH: 'Tailandia', VN: 'Vietnam',
  ID: 'Indonesia', PH: 'Filipinas', AU: 'Australia', NZ: 'Nueva Zelanda', CA: 'Canadá',
};

export async function syncGeo(): Promise<RunCounters> {
  const counters = newCounters();
  const db = await getDb();

  log.info('descargando geografia y taxonomias de iptv-org');
  const [ioCountries, ioSubdivisions, ioCities, ioLanguages, ioRegions] = await Promise.all([
    iptvOrg.countries(),
    iptvOrg.subdivisions(),
    iptvOrg.cities(),
    iptvOrg.languages(),
    iptvOrg.regions(),
  ]);

  /** Un pais pertenece a varias regiones; se guarda la mas especifica (la de menos paises). */
  const regionOf = new Map<string, { code: string; size: number }>();
  for (const region of ioRegions) {
    for (const country of region.countries) {
      const current = regionOf.get(country);
      if (!current || region.countries.length < current.size) {
        regionOf.set(country, { code: region.code, size: region.countries.length });
      }
    }
  }

  const countryRows: Array<{
    code: string;
    name: string;
    nameEs: string | null;
    slug: string;
    flag: string;
    regionCode: string | null;
  }> = ioCountries.map((c) => ({
    code: c.code,
    name: c.name,
    nameEs: NAMES_ES[c.code] ?? null,
    slug: slugify(c.name),
    flag: c.flag,
    regionCode: regionOf.get(c.code)?.code ?? null,
  }));

  dedupeSlugs(countryRows, () => 'country', (row) => row.code);

  for (const batch of chunk(countryRows, 500)) {
    await db
      .insert(countries)
      .values(batch)
      .onConflictDoUpdate({
        target: countries.code,
        set: {
          name: sqlRef('name'),
          nameEs: sqlRef('name_es'),
          slug: sqlRef('slug'),
          flag: sqlRef('flag'),
          regionCode: sqlRef('region_code'),
        },
      });
    counters.inserted += batch.length;
  }
  log.info(`paises: ${countryRows.length}`);

  const knownCountries = new Set(countryRows.map((c) => c.code));
  const subdivisionRows = ioSubdivisions
    .filter((s) => knownCountries.has(s.country))
    .map((s) => ({
      code: s.code,
      countryCode: s.country,
      name: s.name,
      slug: slugify(s.name),
      parentCode: s.parent,
    }));

  // Dos estados del mismo pais pueden producir el mismo slug ("Distrito Capital").
  dedupeSlugs(subdivisionRows, (row) => row.countryCode, (row) => row.code);

  for (const batch of chunk(subdivisionRows, 1000)) {
    await db
      .insert(subdivisions)
      .values(batch)
      .onConflictDoUpdate({
        target: subdivisions.code,
        set: {
          countryCode: sqlRef('country_code'),
          name: sqlRef('name'),
          slug: sqlRef('slug'),
          parentCode: sqlRef('parent_code'),
        },
      });
  }
  log.info(`estados/provincias: ${subdivisionRows.length}`);

  const knownSubdivisions = new Set(subdivisionRows.map((s) => s.code));
  const cityRows = ioCities
    .filter((c) => knownCountries.has(c.country))
    .map((c) => ({
      code: c.code,
      countryCode: c.country,
      subdivisionCode: c.subdivision && knownSubdivisions.has(c.subdivision) ? c.subdivision : null,
      name: c.name,
      slug: slugify(c.name),
    }));
  dedupeSlugs(cityRows, (row) => row.countryCode, (row) => row.code);

  for (const batch of chunk(cityRows, 1000)) {
    await db
      .insert(cities)
      .values(batch)
      .onConflictDoUpdate({
        target: cities.code,
        set: {
          countryCode: sqlRef('country_code'),
          subdivisionCode: sqlRef('subdivision_code'),
          name: sqlRef('name'),
          slug: sqlRef('slug'),
        },
      });
  }
  log.info(`ciudades: ${cityRows.length}`);

  const languageRows = ioLanguages.map((l) => ({
    code: l.code,
    name: l.name,
    slug: slugify(l.name),
  }));
  // Hay idiomas distintos con el mismo nombre corto ("Malay", variantes de arabe):
  // el slug se desempata con el codigo ISO.
  dedupeSlugs(languageRows, () => 'lang', (row) => row.code);
  for (const batch of chunk(languageRows, 1000)) {
    await db
      .insert(languages)
      .values(batch)
      .onConflictDoUpdate({
        target: languages.code,
        set: { name: sqlRef('name'), slug: sqlRef('slug') },
      });
  }
  log.info(`idiomas: ${languageRows.length}`);

  const genreRows = GENRES.map((g) => ({
    slug: g.slug,
    name: g.name,
    nameEs: g.nameEs,
    kind: g.kind,
    parentSlug: g.parent ?? null,
  }));
  await db
    .insert(genres)
    .values(genreRows)
    .onConflictDoUpdate({
      target: genres.slug,
      set: {
        name: sqlRef('name'),
        nameEs: sqlRef('name_es'),
        kind: sqlRef('kind'),
        parentSlug: sqlRef('parent_slug'),
      },
    });
  log.info(`generos: ${genreRows.length}`);

  return counters;
}

/** Referencia a la fila entrante en un ON CONFLICT (excluded.columna). */
function sqlRef(column: string) {
  return sql.raw(`excluded.${column}`);
}

/**
 * Garantiza slugs unicos por pais anadiendo el sufijo del codigo ISO cuando hay
 * choque. Sin esto la web devolveria 500 al crear el indice unico.
 */
function dedupeSlugs<T extends { slug: string }>(
  rows: T[],
  groupOf: (row: T) => string,
  codeOf: (row: T) => string,
): void {
  const seen = new Set<string>();
  for (const row of rows) {
    let key = `${groupOf(row)}:${row.slug}`;
    if (!seen.has(key)) {
      seen.add(key);
      continue;
    }
    const suffix = slugify(codeOf(row));
    row.slug = `${row.slug}-${suffix}`;
    key = `${groupOf(row)}:${row.slug}`;
    let counter = 2;
    while (seen.has(key)) {
      row.slug = `${row.slug}-${counter++}`;
      key = `${groupOf(row)}:${row.slug}`;
    }
    seen.add(key);
  }
}
