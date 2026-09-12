import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getStationBySlug, listSimilarStations } from '@worldtune/db';
import { Breadcrumbs, SectionHeader } from '@/components/FacetGrid';
import { FavoriteButton } from '@/components/FavoriteButton';
import { PlayHero, ReportButton } from '@/components/StationActions';
import { StationList } from '@/components/StationList';
import { StationLogo } from '@/components/StationLogo';
import { loadPlaceNames, placeLabel } from '@/lib/display';
import type { Playable } from '@/lib/playable';

export const revalidate = 1800;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getStationBySlug(slug);
  if (!data) return {};
  return {
    title: data.station.name,
    description: `Escucha ${data.station.name} en directo por internet. Ficha con calidad de señal, géneros y emisoras parecidas.`,
  };
}

export default async function StationPage({ params }: Props) {
  const { slug } = await params;
  const data = await getStationBySlug(slug);
  if (!data) notFound();

  const { station, streams, genres } = data;
  const [names, similar] = await Promise.all([
    loadPlaceNames([station]),
    listSimilarStations(station.id, 9),
  ]);

  const place = placeLabel(names, station);
  const country = station.countryCode ? names.country.get(station.countryCode) : undefined;
  const best = streams.find((stream) => stream.webPlayable) ?? null;

  const item: Playable | null = best
    ? {
        kind: 'station',
        id: station.id,
        name: station.name,
        slug: station.slug,
        logoUrl: station.logoUrl,
        subtitle: place,
        streamUrl: best.resolvedUrl ?? best.url,
        container: best.container,
        needsProxy: best.needsProxy,
      }
    : null;

  return (
    <div className="space-y-9">
      <Breadcrumbs
        items={[
          { href: '/radio', label: 'Radio' },
          ...(country ? [{ href: `/radio/pais/${country.slug}`, label: country.name }] : []),
          { label: station.name },
        ]}
      />

      <section className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
        <StationLogo src={station.logoUrl} name={station.name} size={96} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h1 className="flex-1 text-2xl font-semibold tracking-tight">{station.name}</h1>
            <FavoriteButton kind="station" id={station.id} name={station.name} slug={station.slug} />
          </div>
          {place && <p className="mt-1 text-sm text-ink-300">{place}</p>}

          <div className="mt-3 flex flex-wrap gap-1.5">
            {station.bitrate ? <span className="chip">{station.bitrate} kbps</span> : null}
            {station.codec ? <span className="chip">{station.codec}</span> : null}
            {best?.status === 'ok' && <span className="chip">Verificada</span>}
            {best?.needsProxy && <span className="chip">Se sirve vía relay (origen http)</span>}
            {genres.map((genre) => (
              <Link key={genre.slug} href={`/radio/genero/${genre.slug}`} className="focus-ring chip hover:text-ink-100">
                {genre.nameEs}
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <PlayHero item={item} />
            {station.homepage && (
              <a
                href={station.homepage}
                target="_blank"
                rel="noreferrer noopener"
                className="focus-ring text-sm text-brand-400 hover:underline"
              >
                Sitio oficial de la emisora ↗
              </a>
            )}
            <ReportButton kind="station" id={station.id} />
          </div>
        </div>
      </section>

      <section>
        <SectionHeader
          title="Señales disponibles"
          subtitle="Se elige automáticamente la mejor; aquí están todas las que publica la emisora."
        />
        <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {streams.map((stream) => (
            <li
              key={stream.id}
              className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="chip">{stream.container}</span>
              <span className="chip">{stream.isHttps ? 'https' : 'http'}</span>
              <span className="chip">{statusLabel(stream.status)}</span>
              {stream.latencyMs !== null && <span className="chip">{stream.latencyMs} ms</span>}
              <code className="min-w-0 flex-1 truncate text-xs text-ink-500">{stream.url}</code>
            </li>
          ))}
        </ul>
      </section>

      {similar.length > 0 && (
        <section>
          <SectionHeader title="Emisoras parecidas" subtitle="Mismo país y géneros en común" />
          <StationList stations={similar} />
        </section>
      )}

      {/* Datos estructurados: ayudan a que la ficha aparezca en buscadores. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'RadioStation',
            name: station.name,
            url: `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/radio/emisora/${station.slug}`,
            logo: station.logoUrl ?? undefined,
            sameAs: station.homepage ?? undefined,
            areaServed: place ?? undefined,
            genre: genres.map((genre) => genre.name),
          }),
        }}
      />
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'ok':
      return 'responde';
    case 'cors':
      return 'responde (sin CORS)';
    case 'timeout':
      return 'no contesta';
    case 'gone':
      return 'caída';
    case 'error':
      return 'con error';
    default:
      return 'sin comprobar';
  }
}
