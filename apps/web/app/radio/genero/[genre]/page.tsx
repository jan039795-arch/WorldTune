import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countStations, listGenres, listStations } from '@worldtune/db';
import { Breadcrumbs, FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { Pagination } from '@/components/Pagination';
import { StationList } from '@/components/StationList';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

const PAGE_SIZE = 60;

interface Props {
  params: Promise<{ genre: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { genre: slug } = await params;
  const genres = await listGenres('radio');
  const genre = genres.find((item) => item.slug === slug);
  if (!genre) return {};
  return {
    title: `Radio de ${genre.nameEs} en línea`,
    description: `Emisoras de ${genre.nameEs} de todo el mundo, comprobadas y listas para escuchar.`,
  };
}

export default async function GenrePage({ params, searchParams }: Props) {
  const [{ genre: slug }, { page }] = await Promise.all([params, searchParams]);
  const genres = await listGenres('radio');
  const genre = genres.find((item) => item.slug === slug);
  if (!genre) notFound();

  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const [stations, total] = await Promise.all([
    listStations({ genre: slug, limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE }),
    countStations({ genre: slug }),
  ]);

  const siblings = genres.filter((item) => item.slug !== slug).slice(0, 12);

  return (
    <div className="space-y-8">
      <div>
        <Breadcrumbs
          items={[{ href: '/radio', label: 'Radio' }, { label: genre.nameEs }]}
        />
        <h1 className="text-2xl font-semibold tracking-tight">Radio {genre.nameEs}</h1>
        <p className="mt-1 text-sm text-ink-500">{formatCount(total)} emisoras en todo el mundo</p>
      </div>

      <section>
        <StationList stations={stations} />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath={`/radio/genero/${slug}`}
        />
      </section>

      <section>
        <SectionHeader title="Otros géneros" />
        <FacetGrid
          facets={siblings.map((item) => ({
            href: `/radio/genero/${item.slug}`,
            label: item.nameEs,
            count: item.count,
          }))}
        />
      </section>
    </div>
  );
}
