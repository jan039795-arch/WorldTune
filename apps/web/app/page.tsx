import Link from 'next/link';
import {
  getCatalogStats,
  listCountries,
  listGenres,
  listTopStations,
} from '@worldtune/db';
import { FacetGrid, SectionHeader } from '@/components/FacetGrid';
import { TopStations } from '@/components/TopList';
import { formatCount } from '@/lib/display';

// El catalogo cambia una vez al dia: la portada se regenera cada hora y se sirve
// estatica al resto de visitas.
export const revalidate = 3600;

export default async function HomePage() {
  const [stats, countries, genres, topStations] = await Promise.all([
    getCatalogStats(),
    listCountries('radio'),
    listGenres('radio'),
    listTopStations('listening', 10),
  ]);

  return (
    <div className="space-y-10">
      <section className="card overflow-hidden p-6 sm:p-8">
        <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Radio y televisión de todo el mundo, ordenadas por dónde están.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-ink-300">
          Navega por país, estado, ciudad o género. El reproductor se queda abajo mientras exploras:
          la emisora no se corta al cambiar de página.
        </p>
        <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <Stat label="emisoras" value={stats.stations} />
          <Stat label="canales de TV" value={stats.channels} />
          <Stat label="países" value={stats.countries} />
          <Stat label="ciudades" value={stats.cities} />
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href="/radio"
            className="focus-ring rounded-full bg-brand-500 px-4 py-2 text-sm font-medium text-ink-950 transition hover:bg-brand-400"
          >
            Explorar radio
          </Link>
          <Link
            href="/tv"
            className="focus-ring rounded-full border px-4 py-2 text-sm transition hover:bg-ink-850"
            style={{ borderColor: 'var(--border)' }}
          >
            Explorar televisión
          </Link>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Top 10 mundial"
          subtitle="Lo más escuchado del mundo en las últimas 24 horas, según Radio Browser"
          action={
            <Link href="/top" className="focus-ring text-sm text-brand-400 hover:underline">
              Ver rankings
            </Link>
          }
        />
        <TopStations stations={topStations} metric="listeners24h" />
      </section>

      <section>
        <SectionHeader
          title="Países con más emisoras"
          subtitle={`${formatCount(countries.length)} países con señal en línea`}
          action={
            <Link href="/radio" className="focus-ring text-sm text-brand-400 hover:underline">
              Ver todos
            </Link>
          }
        />
        <FacetGrid
          facets={countries.slice(0, 16).map((country) => ({
            href: `/radio/pais/${country.slug}`,
            label: country.nameEs ?? country.name,
            count: country.count,
            icon: country.flag,
          }))}
        />
      </section>

      <section>
        <SectionHeader title="Géneros" subtitle="Etiquetas normalizadas a una taxonomía propia" />
        <FacetGrid
          facets={genres.slice(0, 20).map((genre) => ({
            href: `/radio/genero/${genre.slug}`,
            label: genre.nameEs,
            count: genre.count,
          }))}
        />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-500">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{formatCount(value)}</dd>
    </div>
  );
}
