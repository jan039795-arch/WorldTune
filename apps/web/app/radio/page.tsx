import type { Metadata } from 'next';
import { listCountries, listGenres, listLanguages, listStations } from '@worldtune/db';
import { Breadcrumbs, FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { StationList } from '@/components/StationList';
import { formatCount } from '@/lib/display';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Radio en línea por país, estado, ciudad y género',
  description:
    'Directorio de emisoras de radio en línea de todo el mundo, agrupadas por país, estado, ciudad, género e idioma.',
};

export default async function RadioHubPage() {
  const [countries, genres, languages, popular] = await Promise.all([
    listCountries('radio'),
    listGenres('radio'),
    listLanguages(),
    listStations({ limit: 9, order: 'popularity' }),
  ]);

  const total = countries.reduce((sum, country) => sum + country.count, 0);

  return (
    <div className="space-y-10">
      <div>
        <Breadcrumbs items={[{ href: '/', label: 'Inicio' }, { label: 'Radio' }]} />
        <h1 className="text-2xl font-semibold tracking-tight">Radio en línea</h1>
        <p className="mt-1 text-sm text-ink-500">
          {formatCount(total)} emisoras comprobadas en {formatCount(countries.length)} países.
        </p>
      </div>

      <section>
        <SectionHeader title="Destacadas" />
        <StationList stations={popular} />
      </section>

      <section>
        <SectionHeader title="Por país" subtitle="Ordenados por número de emisoras disponibles" />
        <FacetGrid
          facets={countries.map((country) => ({
            href: `/radio/pais/${country.slug}`,
            label: country.nameEs ?? country.name,
            count: country.count,
            icon: country.flag,
          }))}
        />
      </section>

      <section>
        <SectionHeader title="Por género" />
        <FacetGrid
          facets={genres.map((genre) => ({
            href: `/radio/genero/${genre.slug}`,
            label: genre.nameEs,
            count: genre.count,
          }))}
        />
      </section>

      <section>
        <SectionHeader title="Por idioma" />
        <FacetGrid
          facets={languages.slice(0, 24).map((language) => ({
            href: `/radio/idioma/${language.code}`,
            label: language.name,
            count: language.stationCount,
          }))}
        />
      </section>
    </div>
  );
}
