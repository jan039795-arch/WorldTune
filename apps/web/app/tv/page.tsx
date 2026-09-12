import type { Metadata } from 'next';
import Link from 'next/link';
import { listChannels, listCountries, listGenres } from '@worldtune/db';
import { ChannelList } from '@/components/ChannelList';
import { Breadcrumbs, FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Televisión en línea por país y categoría',
  description:
    'Canales de televisión que emiten en abierto por internet, organizados por país, estado, ciudad y categoría.',
};

export default async function TvHubPage() {
  const [countries, categories, featured] = await Promise.all([
    listCountries('tv'),
    listGenres('tv'),
    listChannels({ limit: 12 }),
  ]);

  const total = countries.reduce((sum, country) => sum + country.count, 0);

  return (
    <div className="space-y-9">
      <div>
        <Breadcrumbs items={[{ href: '/', label: 'Inicio' }, { label: 'Televisión' }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Televisión en línea</h1>
        <p className="mt-1 text-sm text-ink-500">
          {formatCount(total)} canales en {formatCount(countries.length)} países.
        </p>
      </div>

      <div className="card p-4 text-sm text-ink-300">
        <p>
          Solo se listan señales que los propios canales publican abiertamente en internet. Se aplica
          siempre la lista de bloqueo de iptv-org (retiradas por derechos de autor y contenido adulto) y
          no se redistribuye ni se almacena ninguna emisión.{' '}
          <Link href="/aviso-legal" className="underline hover:text-ink-100">
            Aviso legal
          </Link>
          .
        </p>
      </div>

      <section>
        <SectionHeader title="Canales destacados" />
        <ChannelList channels={featured} />
      </section>

      <section>
        <SectionHeader title="Por país" />
        <FacetGrid
          facets={countries.map((country) => ({
            href: `/tv/pais/${country.slug}`,
            label: country.nameEs ?? country.name,
            count: country.count,
            icon: country.flag,
          }))}
        />
      </section>

      <section>
        <SectionHeader title="Por categoría" />
        <FacetGrid
          facets={categories.map((category) => ({
            href: `/tv/categoria/${category.slug}`,
            label: category.nameEs,
            count: category.count,
          }))}
        />
      </section>
    </div>
  );
}
