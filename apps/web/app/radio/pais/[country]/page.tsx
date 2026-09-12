import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  countStations,
  getCountryBySlug,
  listCities,
  listStations,
  listSubdivisions,
} from '@worldtune/db';
import { Breadcrumbs, FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { Pagination } from '@/components/Pagination';
import { StationList } from '@/components/StationList';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

const PAGE_SIZE = 60;

interface Props {
  params: Promise<{ country: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: slug } = await params;
  const country = await getCountryBySlug(slug);
  if (!country) return {};
  const name = country.nameEs ?? country.name;
  return {
    title: `Radio de ${name} en línea`,
    description: `Emisoras de radio de ${name} organizadas por estado, ciudad y género. ${formatCount(country.stationCount)} estaciones comprobadas.`,
  };
}

export default async function CountryPage({ params, searchParams }: Props) {
  const [{ country: slug }, { page }] = await Promise.all([params, searchParams]);
  const country = await getCountryBySlug(slug);
  if (!country) notFound();

  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const [subdivisions, cities, stations, total] = await Promise.all([
    listSubdivisions(country.code, 'radio'),
    listCities(country.code, undefined, 'radio'),
    listStations({
      countryCode: country.code,
      limit: PAGE_SIZE,
      offset: (currentPage - 1) * PAGE_SIZE,
    }),
    countStations({ countryCode: country.code }),
  ]);

  const name = country.nameEs ?? country.name;

  return (
    <div className="space-y-9">
      <div>
        <Breadcrumbs
          items={[{ href: '/', label: 'Inicio' }, { href: '/radio', label: 'Radio' }, { label: name }]}
        />
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {country.flag && <span aria-hidden>{country.flag}</span>}
          Radio de {name}
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {formatCount(total)} emisoras · {formatCount(subdivisions.length)} estados ·{' '}
          {formatCount(cities.length)} ciudades
        </p>
      </div>

      {subdivisions.length > 0 && (
        <section>
          <SectionHeader title="Por estado o provincia" />
          <FacetGrid
            facets={subdivisions.map((subdivision) => ({
              href: `/radio/pais/${country.slug}/${subdivision.slug}`,
              label: subdivision.name,
              count: subdivision.count,
            }))}
          />
        </section>
      )}

      {cities.length > 0 && (
        <section>
          <SectionHeader title="Por ciudad" subtitle="Las ciudades con más emisoras del país" />
          <FacetGrid
            facets={cities.slice(0, 24).map((city) => ({
              href: `/radio/pais/${country.slug}/ciudad/${city.slug}`,
              label: city.name,
              count: city.count,
            }))}
          />
        </section>
      )}

      <section>
        <SectionHeader title={`Todas las emisoras de ${name}`} />
        <StationList stations={stations} />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath={`/radio/pais/${country.slug}`}
        />
      </section>
    </div>
  );
}
