import { getChannelBySlug } from '@worldtune/db';
import { catalogJson, notFound } from '@/lib/api-response';
import { loadPlaceNames, placeLabel } from '@/lib/display';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const data = await getChannelBySlug(slug);
  if (!data) return notFound('canal');

  const names = await loadPlaceNames([data.channel]);
  return catalogJson({
    channel: { ...data.channel, place: placeLabel(names, data.channel) },
    streams: data.streams.filter((stream) => stream.webPlayable),
    genres: data.genres,
  });
}
