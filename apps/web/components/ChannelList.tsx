import type { ChannelCard as ChannelRow } from '@worldtune/db';
import { ChannelCard } from './ChannelCard';
import { loadPlaceNames, placeLabel } from '@/lib/display';

/** Rejilla de canales de TV con la ubicacion ya resuelta en una sola consulta. */
export async function ChannelList({
  channels,
  emptyMessage = 'No hay canales reproducibles aquí por ahora.',
}: {
  channels: ChannelRow[];
  emptyMessage?: string;
}) {
  if (channels.length === 0) {
    return <p className="card p-6 text-center text-sm text-ink-500">{emptyMessage}</p>;
  }

  const names = await loadPlaceNames(channels.map((channel) => ({ countryCode: channel.countryCode })));

  return (
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {channels.map((channel) => (
        <li key={channel.id}>
          <ChannelCard
            channel={{
              id: channel.id,
              name: channel.name,
              slug: channel.slug,
              logoUrl: channel.logoUrl,
              subtitle: channel.network ?? placeLabel(names, { countryCode: channel.countryCode }),
              quality: channel.quality,
              labels: channel.labels,
              webPlayable: channel.webPlayable,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
