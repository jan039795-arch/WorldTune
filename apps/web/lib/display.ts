import { getDb, schema } from '@worldtune/db';
import { inArray } from 'drizzle-orm';

/**
 * Utilidades de presentacion del lado servidor. Resuelven los nombres de pais,
 * estado y ciudad de un lote de filas en una sola consulta, para que las listas
 * no hagan una consulta por tarjeta.
 */

export interface PlaceNames {
  country: Map<string, { name: string; slug: string; flag: string | null }>;
  subdivision: Map<string, { name: string; slug: string }>;
  city: Map<string, { name: string; slug: string }>;
}

export async function loadPlaceNames(rows: Array<{
  countryCode?: string | null;
  subdivisionCode?: string | null;
  cityCode?: string | null;
}>): Promise<PlaceNames> {
  const db = await getDb();
  const countryCodes = unique(rows.map((row) => row.countryCode));
  const subdivisionCodes = unique(rows.map((row) => row.subdivisionCode));
  const cityCodes = unique(rows.map((row) => row.cityCode));

  const [countryRows, subdivisionRows, cityRows] = await Promise.all([
    countryCodes.length
      ? db
          .select({
            code: schema.countries.code,
            name: schema.countries.name,
            nameEs: schema.countries.nameEs,
            slug: schema.countries.slug,
            flag: schema.countries.flag,
          })
          .from(schema.countries)
          .where(inArray(schema.countries.code, countryCodes))
      : [],
    subdivisionCodes.length
      ? db
          .select({
            code: schema.subdivisions.code,
            name: schema.subdivisions.name,
            slug: schema.subdivisions.slug,
          })
          .from(schema.subdivisions)
          .where(inArray(schema.subdivisions.code, subdivisionCodes))
      : [],
    cityCodes.length
      ? db
          .select({ code: schema.cities.code, name: schema.cities.name, slug: schema.cities.slug })
          .from(schema.cities)
          .where(inArray(schema.cities.code, cityCodes))
      : [],
  ]);

  return {
    country: new Map(
      countryRows.map((row) => [
        row.code,
        { name: row.nameEs ?? row.name, slug: row.slug, flag: row.flag },
      ]),
    ),
    subdivision: new Map(subdivisionRows.map((row) => [row.code, { name: row.name, slug: row.slug }])),
    city: new Map(cityRows.map((row) => [row.code, { name: row.name, slug: row.slug }])),
  };
}

/** "Guadalajara, Jalisco · México" con las partes que existan. */
export function placeLabel(
  names: PlaceNames,
  row: { countryCode?: string | null; subdivisionCode?: string | null; cityCode?: string | null },
): string | null {
  const parts: string[] = [];
  const city = row.cityCode ? names.city.get(row.cityCode) : undefined;
  const subdivision = row.subdivisionCode ? names.subdivision.get(row.subdivisionCode) : undefined;
  const country = row.countryCode ? names.country.get(row.countryCode) : undefined;
  if (city) parts.push(city.name);
  if (subdivision && subdivision.name !== city?.name) parts.push(subdivision.name);
  if (country) parts.push(country.name);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function unique(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/** Formatea 12345 como "12 345" para que los contadores se lean de un golpe. */
export function formatCount(value: number): string {
  return new Intl.NumberFormat('es-MX').format(value);
}
