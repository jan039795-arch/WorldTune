import Link from 'next/link';
import { StationLogo } from './StationLogo';

export interface ChannelCardData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  subtitle: string | null;
  quality: string | null;
  labels: string[] | null;
  /** false en canales que solo emiten dentro de su propio reproductor. */
  webPlayable?: boolean;
}

/**
 * Tarjeta de canal de TV. No lleva boton de reproducir: el video se abre en la
 * ficha del canal, no en una rejilla de veinte reproductores.
 */
export function ChannelCard({ channel }: { channel: ChannelCardData }) {
  const notFullTime = channel.labels?.includes('Not 24/7');
  const geoBlocked = channel.labels?.includes('Geo-blocked');

  return (
    <Link
      href={`/tv/canal/${channel.slug}`}
      className="focus-ring card flex items-center gap-3 p-3 transition hover:bg-ink-850"
    >
      <StationLogo src={channel.logoUrl} name={channel.name} size={48} rounded="rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{channel.name}</p>
        <p className="truncate text-xs text-ink-500">
          {channel.subtitle ?? 'Sin ubicación'}
          {channel.quality ? ` · ${channel.quality}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {channel.webPlayable === false && <span className="chip">Solo en su sitio</span>}
        {geoBlocked && <span className="chip">Geobloqueado</span>}
        {notFullTime && <span className="chip">No 24/7</span>}
      </div>
    </Link>
  );
}
