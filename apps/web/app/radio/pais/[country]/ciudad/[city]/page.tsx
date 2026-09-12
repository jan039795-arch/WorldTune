import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { countStations, getCityBySlug, getCountryBySlug, listStations } from '@worldtune/db';
import { Breadcrumbs, SectionHeader } from '@/components/FacetGrid';
import { Pagination } from '@/components/Pagination';
import { StationList } from '@/components/StationList';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

const PAGE_SIZE = 60;

interface Props {
  params: Promise<{ country: string; city: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country: countrySlug, city: citySlug } = await params;
  const country = await getCountryBySlug(countrySlug);
  if (!country) return {};
  const city = await getCityBySlug(country.code, citySlug);
  if (!city) return {};
  return {
    title: `Radio de ${city.name}`,
    description: `Emisoras de radio en línea de ${city.name}, ${country.nameEs ?? country.name}.`,
  };
}

export default async function CityPage({ params, searchParams }: Props) {
  const [{ country: countrySlug, city: citySlug }, { page }] = await Promise.all([
    params,
    searchParams,
  ]);
  const country = await getCountryBySlug(countrySlug);
  if (!country) notFound();
  const city = await getCityBySlug(country.code, citySlug);
  if (!city) notFound();

  const currentPage = Math.max(1, Number.parseInt(page ?? '1', 10) || 1);
  const filter = { countryCode: country.code, cityCode: city.code };
  const [stations, total] = await Promise.all([
    listStations({ ...filter, limit: PAGE_SIZE, offset: (currentPage - 1) * PAGE_SIZE }),
    countStations(filter),
  ]);

  const countryName = country.nameEs ?? country.name;

  return (
    <div className="space-y-6">
      <div>
        <Breadcrumbs
          items={[
            { href: '/radio', label: 'Radio' },
            { href: `/radio/pais/${country.slug}`, label: countryName },
            { label: city.name },
          ]}
        />
        <h1 className="text-2xl font-semibold tracking-tight">Radio de {city.name}</h1>
        <p className="mt-1 text-sm text-ink-500">
          {countryName} · {formatCount(total)} emisoras
        </p>
      </div>

      <section>
        <SectionHeader title="Emisoras locales" />
        <StationList stations={stations} />
        <Pagination
          page={currentPage}
          pageSize={PAGE_SIZE}
          total={total}
          basePath={`/radio/pais/${country.slug}/ciudad/${city.slug}`}
        />
      </section>
    </div>
  );
}
