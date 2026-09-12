import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countChannels, listChannels, listGenres } from '@worldtune/db';
import { ChannelList } from '@/components/ChannelList';
import { Breadcrumbs, FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { Pagination } from '@/components/Pagination';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

const PAGE_SIZE = 60;

interface Props {
  params: Promise<{ genre: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre: slug } = await params;
  const category = (await listGenres('tv')).find((item) => item.slug === slug);
  if (!category) return {};
  return {
    title: `Canales de ${category.nameEs} en línea`,
    description: `Televisión en línea de la categoría ${category.nameEs}.`,
  };
}

export default async function TvCategoryPage({ params, searchParams }: Props) {
  const [{ genre: slug }, { page }] = await Promise.all([params, searchParams]);
  const categories = await listGenres('tv');
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const [channels, total] = await Promise.all([
    listChannels({ genre: slug, limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE }),
    countChannels({ genre: slug }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs items={[{ href: '/tv', label: 'Televisión' }, { label: category.nameEs }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Canales de {category.nameEs}</h1>
        <p className="mt-1 text-sm text-ink-500">{formatCount(total)} canales</p>
      </div>

      <section>
        <ChannelList channels={channels} />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath={`/tv/categoria/${slug}`}
        />
      </section>

      <section>
        <SectionHeader title="Otras categorías" />
        <FacetGrid
          facets={categories
            .filter((item) => item.slug !== slug)
            .map((item) => ({
              href: `/tv/categoria/${item.slug}`,
              label: item.nameEs,
              count: item.count,
            }))}
        />
      </section>
    </div>
  );
}
