import { fold } from './slug';

/**
 * Resolucion geografica. El problema real: Radio Browser entrega el estado como
 * texto libre ("Ciudad de Mexico", "D.F.", "Estado de Jalisco") mientras que la
 * jerarquia canonica viene de iptv-org con codigos ISO-3166-2. Este modulo
 * construye un indice para casar lo uno con lo otro.
 */

export interface SubdivisionRef {
  /** Codigo ISO-3166-2, p. ej. MX-JAL. */
  code: string;
  country: string;
  name: string;
}

export interface CityRef {
  code: string;
  country: string;
  subdivision: string | null;
  name: string;
}

/** Prefijos administrativos que sobran al comparar nombres. */
const NOISE = [
  'estado de', 'estado', 'provincia de', 'provincia', 'departamento de', 'departamento',
  'region de', 'region', 'comunidad autonoma de', 'comunidad de', 'state of', 'state',
  'province of', 'province', 'district of', 'district', 'prefecture', 'county', 'condado de',
  'municipio de', 'municipality of', 'city of', 'ciudad de',
];

/** Alias manuales de estados que ninguna comparacion textual resuelve. */
const SUBDIVISION_ALIASES: Record<string, string> = {
  'MX:df': 'MX-CMX',
  'MX:d f': 'MX-CMX',
  'MX:distrito federal': 'MX-CMX',
  'MX:mexico df': 'MX-CMX',
  'MX:cdmx': 'MX-CMX',
  'MX:estado de mexico': 'MX-MEX',
  'MX:edomex': 'MX-MEX',
  'MX:michoacan de ocampo': 'MX-MIC',
  'MX:veracruz de ignacio de la llave': 'MX-VER',
  'MX:coahuila de zaragoza': 'MX-COA',
  'MX:baja california norte': 'MX-BCN',
  'MX:queretaro de arteaga': 'MX-QUE',
  'US:washington dc': 'US-DC',
  'US:district of columbia': 'US-DC',
  'ES:madrid': 'ES-MD',
  'ES:cataluna': 'ES-CT',
  'ES:catalunya': 'ES-CT',
  'AR:caba': 'AR-C',
  'AR:capital federal': 'AR-C',
  'AR:buenos aires city': 'AR-C',
  'BR:sao paulo': 'BR-SP',
  'BR:rio de janeiro': 'BR-RJ',
};

function stripNoise(value: string): string {
  let out = fold(value).replace(/[.]/g, '').replace(/\s+/g, ' ').trim();
  for (const prefix of NOISE) {
    if (out.startsWith(prefix + ' ')) {
      out = out.slice(prefix.length + 1);
      break;
    }
  }
  return out.trim();
}

/**
 * Entidades cuyo territorio coincide con una sola ciudad. Para estas, y solo
 * para estas, el texto del estado tambien identifica la ciudad. Sin esta lista
 * el campo "state" de Radio Browser produce ciudades inventadas: una emisora con
 * state="Jalisco" acabaria asignada a un pueblo llamado Jalisco.
 */
export const CITY_SUBDIVISIONS = new Set([
  'MX-CMX', // Ciudad de Mexico
  'AR-C', // Ciudad Autonoma de Buenos Aires
  'BR-DF', // Distrito Federal (Brasilia)
  'CO-DC', // Bogota D.C.
  'VE-A', // Distrito Capital (Caracas)
  'US-DC', // Washington D.C.
  'PE-LMA', // Lima Metropolitana
  'EC-P', // (Quito, distrito metropolitano)
]);

/**
 * Nombres de ciudad demasiado genericos para deducirlos del nombre de una emisora:
 * "Radio Centro" no esta en la ciudad de Centro, Tabasco. Solo afectan a la
 * deduccion por texto libre, no a un par explicito "Ciudad, Estado".
 */
const GENERIC_PLACE_WORDS = new Set([
  'centro', 'ciudad', 'progreso', 'libertad', 'reforma', 'union', 'independencia',
  'esperanza', 'universidad', 'capital', 'central', 'primavera', 'buenavista',
]);

export class GeoIndex {
  /** "MX:jalisco" -> "MX-JAL" */
  private readonly subByName = new Map<string, string>();
  private readonly subByCode = new Map<string, SubdivisionRef>();
  /** "MX:guadalajara" -> ["MXGDL", ...] (puede haber homonimos) */
  private readonly cityByName = new Map<string, CityRef[]>();
  private readonly cityByCode = new Map<string, CityRef>();
  /**
   * Nombres que son de un estado en ese pais. Existen pueblos llamados "Jalisco",
   * "Sonora" o "Tamaulipas"; cuando ese texto aparece es casi siempre el estado,
   * no la aldea homonima, asi que se bloquea como ciudad.
   */
  private readonly subdivisionNames = new Set<string>();

  constructor(subdivisions: SubdivisionRef[], cities: CityRef[]) {
    for (const sub of subdivisions) {
      this.subByCode.set(sub.code, sub);
      this.subByName.set(`${sub.country}:${stripNoise(sub.name)}`, sub.code);
      this.subdivisionNames.add(`${sub.country}:${stripNoise(sub.name)}`);
      // El sufijo del codigo tambien aparece escrito a mano: "JAL", "BCS".
      const suffix = sub.code.split('-')[1];
      if (suffix && suffix.length >= 2) {
        const key = `${sub.country}:${fold(suffix)}`;
        if (!this.subByName.has(key)) this.subByName.set(key, sub.code);
      }
    }
    for (const [alias, code] of Object.entries(SUBDIVISION_ALIASES)) {
      if (this.subByCode.has(code)) this.subByName.set(alias, code);
    }
    for (const city of cities) {
      this.cityByCode.set(city.code, city);
      const key = `${city.country}:${stripNoise(city.name)}`;
      const bucket = this.cityByName.get(key);
      if (bucket) bucket.push(city);
      else this.cityByName.set(key, [city]);
    }
  }

  subdivision(code: string): SubdivisionRef | undefined {
    return this.subByCode.get(code);
  }

  city(code: string): CityRef | undefined {
    return this.cityByCode.get(code);
  }

  /**
   * Resuelve el texto libre de estado a un codigo ISO-3166-2.
   *
   * Radio Browser suele traer "Ciudad, Estado" (p. ej. "Autlan, Jalisco"), asi que
   * se prueba el texto completo, luego el ultimo segmento (el estado) y por ultimo
   * el primero.
   */
  matchSubdivision(countryCode: string, stateText: string | null | undefined): string | null {
    if (!stateText) return null;
    const country = countryCode.toUpperCase();
    const normalized = stripNoise(stateText);
    if (!normalized) return null;

    const direct = this.subByName.get(`${country}:${normalized}`);
    if (direct) return direct;

    const segments = stateText
      .split(/[,/|]/)
      .map((part) => stripNoise(part))
      .filter(Boolean);
    if (segments.length > 1) {
      const last = this.subByName.get(`${country}:${segments[segments.length - 1]}`);
      if (last) return last;
    }
    for (const segment of segments) {
      const found = this.subByName.get(`${country}:${segment}`);
      if (found) return found;
    }
    return null;
  }

  /** true si ese texto nombra un estado de ese pais. */
  isSubdivisionName(countryCode: string, text: string): boolean {
    return this.subdivisionNames.has(`${countryCode.toUpperCase()}:${stripNoise(text)}`);
  }

  /**
   * Busca una ciudad por nombre. Con subdivision conocida se desempatan los
   * homonimos (hay decenas de "San Jose" y "Santiago" por pais).
   */
  matchCity(
    countryCode: string,
    cityText: string | null | undefined,
    subdivisionCode?: string | null,
    options: { allowSubdivisionHomonym?: boolean } = {},
  ): string | null {
    if (!cityText) return null;
    const country = countryCode.toUpperCase();
    if (!options.allowSubdivisionHomonym && this.isSubdivisionName(country, cityText)) return null;
    const candidates = this.cityByName.get(`${country}:${stripNoise(cityText)}`);
    if (!candidates || candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0]!.code;
    if (subdivisionCode) {
      const inSub = candidates.find((c) => c.subdivision === subdivisionCode);
      if (inSub) return inSub.code;
    }
    return null; // ambiguo: mejor sin ciudad que con la ciudad equivocada
  }

  /**
   * Decide la ciudad de una emisora con las tres fuentes disponibles, en orden de
   * fiabilidad. Existe como un unico metodo para que la regla viva en un solo
   * sitio: es la parte del catalogo mas facil de contaminar con datos inventados.
   */
  resolveCity(
    countryCode: string,
    input: {
      /** Nombre de la emisora: "Radio Universidad de Guadalajara". */
      name: string;
      /** Texto libre del campo state de Radio Browser. */
      stateText?: string | null;
      /** Estado ya resuelto, si se logro. */
      subdivisionCode?: string | null;
      /** true si stateText fue lo que resolvio el estado (entonces es un estado, no una ciudad). */
      stateIsSubdivision: boolean;
    },
  ): string | null {
    // 1. La fuente mas fiable: "Ciudad, Estado". La primera parte es la ciudad.
    const segments = (input.stateText ?? '')
      .split(/[,/|]/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (segments.length > 1) {
      const fromPair = this.matchCity(countryCode, segments[0], input.subdivisionCode);
      if (fromPair) return fromPair;
    }

    // 2. El nombre de la emisora suele terminar en la ciudad.
    const fromName = this.guessCityFromText(countryCode, input.name, input.subdivisionCode);
    if (fromName) return fromName;

    // 3. El campo state a veces trae en realidad una ciudad ("Guadalajara").
    if (input.stateText && !input.stateIsSubdivision) {
      const fromState = this.matchCity(countryCode, input.stateText, input.subdivisionCode);
      if (fromState) return fromState;
    }

    // 4. Distritos federales: el estado ES la ciudad.
    if (input.subdivisionCode && CITY_SUBDIVISIONS.has(input.subdivisionCode)) {
      const sub = this.subdivision(input.subdivisionCode);
      if (sub) {
        return this.matchCity(countryCode, sub.name, input.subdivisionCode, {
          allowSubdivisionHomonym: true,
        });
      }
    }
    return null;
  }

  /**
   * Ultimo recurso para la radio: buscar el nombre de una ciudad del pais dentro
   * del nombre de la emisora ("Radio Universidad de Guadalajara"). Solo se acepta
   * cuando el nombre de la ciudad tiene al menos 5 letras, para no casar "Leon"
   * o "Paz" por accidente.
   */
  guessCityFromText(
    countryCode: string,
    text: string,
    subdivisionCode?: string | null,
  ): string | null {
    const haystack = ` ${stripNoise(text)} `;
    const country = countryCode.toUpperCase();
    let best: CityRef | null = null;
    for (const [key, cities] of this.cityByName) {
      if (!key.startsWith(`${country}:`)) continue;
      const name = key.slice(country.length + 1);
      if (name.length < 5) continue;
      // "Radio XY - Autlan, Jalisco" habla del estado, no del pueblo de Jalisco.
      if (this.subdivisionNames.has(key)) continue;
      if (GENERIC_PLACE_WORDS.has(name)) continue;
      if (!haystack.includes(` ${name} `)) continue;
      const candidate =
        (subdivisionCode ? cities.find((c) => c.subdivision === subdivisionCode) : undefined) ??
        (cities.length === 1 ? cities[0] : undefined);
      if (!candidate) continue;
      // El nombre mas largo es el mas especifico: "San Luis Potosi" gana a "San Luis".
      if (!best || name.length > stripNoise(best.name).length) best = candidate;
    }
    return best?.code ?? null;
  }
}

/** Parsea un `broadcast_area` de iptv-org: c/MX, s/MX-JAL, ct/MXGDL, r/LATAM. */
export function parseBroadcastArea(area: string): {
  kind: 'country' | 'subdivision' | 'city' | 'region';
  code: string;
} | null {
  const [prefix, code] = area.split('/');
  if (!prefix || !code) return null;
  switch (prefix) {
    case 'c':
      return { kind: 'country', code };
    case 's':
      return { kind: 'subdivision', code };
    case 'ct':
      return { kind: 'city', code };
    case 'r':
      return { kind: 'region', code };
    default:
      return null;
  }
}
