import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countChannels, getCountryBySlug, listChannels, listSubdivisions } from '@worldtune/db';
import { ChannelList } from '@/components/ChannelList';
import { Breadcrumbs, FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { Pagination } from '@/components/Pagination';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

const PAGE_SIZE = 60;

interface Props {
  params: Promise<{ country: string }>;
  searchParams: Promise<{ page?: string; estado?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: slug } = await params;
  const country = await getCountryBySlug(slug);
  if (!country) return {};
  const name = country.nameEs ?? country.name;
  return {
    title: `Televisión de ${name} en línea`,
    description: `Canales de televisión de ${name} que emiten abiertamente por internet.`,
  };
}

export default async function TvCountryPage({ params, searchParams }: Props) {
  const [{ country: slug }, query] = await Promise.all([params, searchParams]);
  const country = await getCountryBySlug(slug);
  if (!country) notFound();

  const currentPage = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
  const filter = { countryCode: country.code, subdivisionCode: query.estado };
  const [subdivisions, channels, total] = await Promise.all([
    listSubdivisions(country.code, 'tv'),
    listChannels({ ...filter, limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE }),
    countChannels(filter),
  ]);

  const name = country.nameEs ?? country.name;

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs
          items={[
            { href: '/tv', label: 'Televisión' },
            { label: name },
          ]}
        />
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {country.flag && <span aria-hidden>{country.flag}</span>}
          Televisión de {name}
        </h1>
        <p className="mt-1 text-sm text-ink-500">{formatCount(total)} canales</p>
      </div>

      {subdivisions.length > 0 && (
        <section>
          <SectionHeader title="Señales regionales" subtitle="Canales cuya emisión es de un estado concreto" />
          <FacetGrid
            facets={subdivisions.map((subdivision) => ({
              href: `/tv/pais/${country.slug}?estado=${subdivision.code}`,
              label: subdivision.name,
              count: subdivision.count,
            }))}
          />
        </section>
      )}

      <section>
        <SectionHeader title="Canales" />
        <ChannelList channels={channels} />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath={`/tv/pais/${country.slug}`}
          query={query.estado ? { estado: query.estado } : {}}
        />
      </section>
    </div>
  );
}
