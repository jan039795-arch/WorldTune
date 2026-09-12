import type { Metadata } from 'next';
import { countChannels, countStations, listChannels, listStations } from '@worldtune/db';
import { ChannelList } from '@/components/ChannelList';
import { SectionHeader } from '@/components/FacetGrid';
import { StationList } from '@/components/StationList';
import { formatCount } from '@/lib/display';

export const metadata: Metadata = {
  title: 'Buscar emisoras y canales',
  robots: { index: false },
};

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  if (query.length < 2) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Buscar</h1>
        <p className="text-sm text-ink-500">Escribe al menos dos letras.</p>
      </div>
    );
  }

  const [stations, channels, stationTotal, channelTotal] = await Promise.all([
    listStations({ query, limit: 30 }),
    listChannels({ query, limit: 30 }),
    countStations({ query }),
    countChannels({ query }),
  ]);

  return (
    <div className="space-y-9">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Resultados para «{query}»
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          {formatCount(stationTotal)} emisoras y {formatCount(channelTotal)} canales
        </p>
      </div>

      <section>
        <SectionHeader title="Radio" />
        <StationList stations={stations} emptyMessage="Ninguna emisora coincide." />
      </section>

      <section>
        <SectionHeader title="Televisión" />
        <ChannelList channels={channels} emptyMessage="Ningún canal coincide." />
      </section>
    </div>
  );
}
