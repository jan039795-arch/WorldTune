import { fetchJsonCached } from './http';

/**
 * Cliente de iptv-org (https://iptv-org.github.io/api). Son volcados JSON
 * estaticos, uno por entidad, que se regeneran a diario.
 *
 * Importante: `blocklist.json` no es opcional. Ahi estan los canales retirados
 * por DMCA y los marcados NSFW, y el catalogo debe respetarlo siempre.
 */

const BASE = 'https://iptv-org.github.io/api';

export interface IoChannel {
  id: string;
  name: string;
  alt_names: string[];
  network: string | null;
  owners: string[];
  country: string;
  categories: string[];
  is_nsfw: boolean;
  launched: string | null;
  closed: string | null;
  replaced_by: string | null;
  website: string | null;
}

export interface IoFeed {
  channel: string;
  id: string;
  name: string;
  alt_names: string[];
  is_main: boolean;
  /** c/MX, s/MX-JAL, ct/MXGDL, r/LATAM */
  broadcast_area: string[];
  timezones: string[];
  languages: string[];
  format: string | null;
}

export interface IoStream {
  channel: string | null;
  feed: string | null;
  title: string | null;
  url: string;
  quality: string | null;
  /** "Not 24/7", "Geo-blocked", ... */
  labels: string[];
  user_agent: string | null;
  referrer: string | null;
}

export interface IoLogo {
  channel: string;
  feed: string | null;
  in_use: boolean;
  tags: string[];
  width: number;
  height: number;
  format: string;
  url: string;
}

export interface IoCategory {
  id: string;
  name: string;
  description: string;
}

export interface IoCountry {
  name: string;
  code: string;
  languages: string[];
  flag: string;
}

export interface IoSubdivision {
  country: string;
  code: string;
  name: string;
  parent: string | null;
}

export interface IoCity {
  country: string;
  subdivision: string | null;
  code: string;
  name: string;
  wikidata_id: string | null;
}

export interface IoRegion {
  code: string;
  name: string;
  countries: string[];
}

export interface IoLanguage {
  name: string;
  code: string;
}

export interface IoBlocked {
  channel: string;
  reason: 'dmca' | 'nsfw' | string;
  ref: string;
}

async function load<T>(name: string, maxAgeMs?: number): Promise<T[]> {
  return fetchJsonCached<T[]>(`${BASE}/${name}.json`, `iptv-org-${name}`, maxAgeMs);
}

export const iptvOrg = {
  channels: () => load<IoChannel>('channels'),
  feeds: () => load<IoFeed>('feeds'),
  streams: () => load<IoStream>('streams', 60 * 60 * 1000),
  logos: () => load<IoLogo>('logos'),
  categories: () => load<IoCategory>('categories'),
  countries: () => load<IoCountry>('countries'),
  subdivisions: () => load<IoSubdivision>('subdivisions'),
  cities: () => load<IoCity>('cities'),
  regions: () => load<IoRegion>('regions'),
  languages: () => load<IoLanguage>('languages'),
  blocklist: () => load<IoBlocked>('blocklist', 60 * 60 * 1000),
};

/** Conjunto de ids de canal vetados, listo para filtrar en la ingesta. */
export async function loadBlockedChannelIds(): Promise<Map<string, string>> {
  const entries = await iptvOrg.blocklist();
  return new Map(entries.map((entry) => [entry.channel, entry.reason]));
}
