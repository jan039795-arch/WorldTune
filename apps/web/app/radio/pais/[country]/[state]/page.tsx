import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  countStations,
  getCountryBySlug,
  getSubdivisionBySlug,
  listCities,
  listStations,
} from '@worldtune/db';
import { Breadcrumbs, FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { Pagination } from '@/components/Pagination';
import { StationList } from '@/components/StationList';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

const PAGE_SIZE = 60;

interface Props {
  params: Promise<{ country: string; state: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: countrySlug, state: stateSlug } = await params;
  const country = await getCountryBySlug(countrySlug);
  if (!country) return {};
  const subdivision = await getSubdivisionBySlug(country.code, stateSlug);
  if (!subdivision) return {};
  return {
    title: `Radio de ${subdivision.name}, ${country.nameEs ?? country.name}`,
    description: `Emisoras de radio en línea de ${subdivision.name} (${country.nameEs ?? country.name}), por ciudad y género.`,
  };
}

export default async function SubdivisionPage({ params, searchParams }: Props) {
  const [{ country: countrySlug, state: stateSlug }, { page }] = await Promise.all([
    params,
    searchParams,
  ]);
  const country = await getCountryBySlug(countrySlug);
  if (!country) notFound();
  const subdivision = await getSubdivisionBySlug(country.code, stateSlug);
  if (!subdivision) notFound();

  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const filter = { countryCode: country.code, subdivisionCode: subdivision.code };
  const [cities, stations, total] = await Promise.all([
    listCities(country.code, subdivision.code, 'radio'),
    listStations({ ...filter, limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE }),
    countStations(filter),
  ]);

  const countryName = country.nameEs ?? country.name;

  return (
    <div className="space-y-9">
      <div>
        <Breadcrumbs
          items={[
            { href: '/radio', label: 'Radio' },
            { href: `/radio/pais/${country.slug}`, label: countryName },
            { label: subdivision.name },
          ]}
        />
        <h1 className="text-2xl font-semibold tracking-tight">Radio de {subdivision.name}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {countryName} · {formatCount(total)} emisoras
        </p>
      </div>

      {cities.length > 0 && (
        <section>
          <SectionHeader title="Ciudades" />
          <FacetGrid
            facets={cities.map((city) => ({
              href: `/radio/pais/${country.slug}/ciudad/${city.slug}`,
              label: city.name,
              count: city.count,
            }))}
          />
        </section>
      )}

      <section>
        <SectionHeader title="Emisoras" />
        <StationList stations={stations} />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath={`/radio/pais/${country.slug}/${subdivision.slug}`}
        />
      </section>
    </div>
  );
}
