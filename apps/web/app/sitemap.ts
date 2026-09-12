import type { MetadataRoute } from 'next';
import { listCountries, listGenres, listStations } from '@worldtune/db';

/**
 * Mapa del sitio. Se incluyen las paginas de navegacion (paises, generos) y las
 * emisoras mas populares, no las 50 000: un sitemap gigantesco se rastrea peor y
 * la cola larga se alcanza desde las paginas de pais y ciudad.
 */
export const revalidate = 86400;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const [countries, tvCountries, radioGenres, tvGenres, topStations] = await Promise.all([
    listCountries('radio'),
    listCountries('tv'),
    listGenres('radio'),
    listGenres('tv'),
    listStations({ limit: 500, order: 'popularity' }),
  ]);

  const now = new Date();
  return [
    { url: base, lastModified: now, priority: 1 },
    { url: `${base}/radio`, lastModified: now, priority: 0.9 },
    { url: `${base}/tv`, lastModified: now, priority: 0.9 },
    { url: `${base}/aviso-legal`, lastModified: now, priority: 0.2 },
    ...countries.map((country) => ({
      url: `${base}/radio/pais/${country.slug}`,
      lastModified: now,
      priority: 0.8,
    })),
    ...tvCountries.map((country) => ({
      url: `${base}/tv/pais/${country.slug}`,
      lastModified: now,
      priority: 0.7,
    })),
    ...radioGenres.map((genre) => ({
      url: `${base}/radio/genero/${genre.slug}`,
      lastModified: now,
      priority: 0.6,
    })),
    ...tvGenres.map((genre) => ({
      url: `${base}/tv/categoria/${genre.slug}`,
      lastModified: now,
      priority: 0.5,
    })),
    ...topStations.map((station) => ({
      url: `${base}/radio/emisora/${station.slug}`,
      lastModified: now,
      priority: 0.5,
    })),
  ];
}
