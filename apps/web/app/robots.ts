import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  return {
    rules: [
      // El buscador y el relay no aportan nada al indice y gastan rastreo.
      { userAgent: '*', allow: '/', disallow: ['/api/', '/buscar'] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
