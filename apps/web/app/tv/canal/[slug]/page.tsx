import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChannelBySlug, listChannels } from '@worldtune/db';
import { ChannelList } from '@/components/ChannelList';
import { Breadcrumbs, SectionHeader } from '@/components/FacetGrid';
import { FavoriteButton } from '@/components/FavoriteButton';
import { ReportButton } from '@/components/StationActions';
import { StationLogo } from '@/components/StationLogo';
import { VideoPlayer } from '@/components/VideoPlayer';
import { loadPlaceNames, placeLabel } from '@/lib/display';

export const revalidate = 1800;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const data = await getChannelBySlug(slug);
  if (!data) return {};
  return {
    title: `${data.channel.name} en directo`,
    description: `Ver ${data.channel.name} en línea. Señal pública del canal, con información de calidad y disponibilidad.`,
  };
}

export default async function ChannelPage({ params }: Props) {
  const { slug } = await params;
  const data = await getChannelBySlug(slug);
  if (!data) notFound();

  const { channel, streams, genres } = data;
  const playable = streams.filter((stream) => stream.webPlayable);
  const best = playable[0] ?? null;

  const [names, siblings] = await Promise.all([
    loadPlaceNames([channel]),
    channel.countryCode
      ? listChannels({ countryCode: channel.countryCode, limit: 9 })
      : Promise.resolve([]),
  ]);
  const country = channel.countryCode ? names.country.get(channel.countryCode) : undefined;
  const place = placeLabel(names, channel);

  return (
    <div className="space-y-8">
      <Breadcrumbs
        items={[
          { href: '/tv', label: 'Televisión' },
          ...(country ? [{ href: `/tv/pais/${country.slug}`, label: country.name }] : []),
          { label: channel.name },
        ]}
      />

      {best ? (
        <VideoPlayer
          url={best.resolvedUrl ?? best.url}
          container={best.container}
          poster={channel.logoUrl}
          title={channel.name}
          channelId={channel.id}
        />
      ) : (
        <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm text-ink-300">
            {channel.curated ? (
              <>
                <p className="font-medium text-ink-100">
                  Este canal emite en directo, pero solo dentro de su propio reproductor.
                </p>
                <p className="mt-1">
                  Usa una sesión con token (el enlace de vídeo caduca y no funciona fuera de su web),
                  así que aquí se enlaza en vez de incrustarlo.
                </p>
              </>
            ) : (
              <p>
                Este canal no tiene ninguna señal reproducible en un navegador: el origen exige
                cabeceras propias (<code>referrer</code> o <code>user-agent</code>) que el navegador no
                permite fijar, o no envía cabeceras CORS.
              </p>
            )}
          </div>
          {channel.website && (
            <a
              href={channel.website}
              target="_blank"
              rel="noreferrer noopener"
              className="focus-ring shrink-0 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-brand-400"
            >
              Ver en el sitio oficial ↗
            </a>
          )}
        </div>
      )}

      <section className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <StationLogo src={channel.logoUrl} name={channel.name} size={72} rounded="rounded-md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h1 className="flex-1 text-2xl font-semibold tracking-tight">{channel.name}</h1>
            <FavoriteButton kind="channel" id={channel.id} name={channel.name} slug={channel.slug} />
          </div>
          <p className="mt-1 text-sm text-ink-300">
            {[channel.network, place].filter(Boolean).join(' · ') || 'Sin información de ubicación'}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {best?.quality && <span className="chip">{best.quality}</span>}
            {best?.labels?.map((label) => (
              <span key={label} className="chip">
                {label === 'Geo-blocked' ? 'Geobloqueado' : label}
              </span>
            ))}
            {genres.map((genre) => (
              <Link
                key={genre.slug}
                href={`/tv/categoria/${genre.slug}`}
                className="focus-ring chip hover:text-ink-100"
              >
                {genre.nameEs}
              </Link>
            ))}
            {channel.timezone && <span className="chip">{channel.timezone}</span>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            {channel.website && (
              <a
                href={channel.website}
                target="_blank"
                rel="noreferrer noopener"
                className="focus-ring text-brand-400 hover:underline"
              >
                Sitio oficial del canal ↗
              </a>
            )}
            <ReportButton kind="channel" id={channel.id} />
          </div>
        </div>
      </section>

      {playable.length > 1 && (
        <section>
          <SectionHeader title="Otras señales del canal" />
          <ul className="card divide-y" style={{ borderColor: 'var(--border)' }}>
            {playable.map((stream) => (
              <li key={stream.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
                <span className="chip">{stream.quality ?? 'calidad desconocida'}</span>
                <span className="chip">{stream.container}</span>
                {stream.feedId && <span className="chip">{stream.feedId}</span>}
                <code className="min-w-0 flex-1 truncate text-xs text-ink-500">{stream.url}</code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {siblings.length > 0 && (
        <section>
          <SectionHeader title={`Más canales de ${country?.name ?? 'la zona'}`} />
          <ChannelList channels={siblings.filter((item) => item.id !== channel.id)} />
        </section>
      )}
    </div>
  );
}
