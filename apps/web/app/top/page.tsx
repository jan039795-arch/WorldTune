import type { Metadata } from 'next';
import Link from 'next/link';
import { listChannels, listTopChannels, listTopStations } from '@worldtune/db';
import { ChannelList } from '@/components/ChannelList';
import { SectionHeader } from '@/components/FacetGrid';
import { TopChannels, TopStations } from '@/components/TopList';

export const revalidate = 600;

export const metadata: Metadata = {
  title: 'Top 10 mundial de radio y televisión',
  description:
    'Las diez emisoras más escuchadas del mundo según los datos de Radio Browser, las que más suben hoy, y lo más visto en WorldTune.',
};

export default async function TopPage() {
  const [mostListened, mostVoted, topChannels, fallbackChannels] = await Promise.all([
    listTopStations('listening', 10),
    listTopStations('voted', 10),
    listTopChannels(10),
    listChannels({ limit: 9, curatedOnly: false }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Top 10</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-500">
          Cada lista mide una cosa distinta y lo dice: no es lo mismo lo que más suena hoy que lo
          que más gusta desde siempre, ni una audiencia mundial que las reproducciones de esta
          plataforma.
        </p>
      </div>

      <section>
        <SectionHeader
          title="Las 10 más escuchadas del mundo ahora"
          subtitle="Escuchas de las últimas 24 horas en toda la comunidad de Radio Browser, no solo aquí"
        />
        <TopStations stations={mostListened} metric="listeners24h" />
      </section>

      <section>
        <SectionHeader
          title="Las 10 favoritas de siempre"
          subtitle="Votos acumulados de la comunidad desde que existe cada emisora: reputación, no audiencia de hoy"
        />
        <TopStations stations={mostVoted} metric="votes" />
      </section>

      <section>
        <SectionHeader
          title="Lo más visto en televisión"
          subtitle="Reproducciones contadas en WorldTune"
        />
        {topChannels.length > 0 ? (
          <TopChannels channels={topChannels} />
        ) : (
          <div className="space-y-4">
            <div className="card p-5 text-sm text-ink-300">
              <p className="font-medium text-ink-100">Todavía no hay un top de televisión, y no lo hay por una razón.</p>
              <p className="mt-2">
                Para la radio existe un dato de audiencia mundial: Radio Browser cuenta las escuchas de
                toda su comunidad y ese número es el que ves arriba. Para la televisión{' '}
                <strong className="text-ink-100">no existe nada equivalente</strong>: iptv-org publica
                los canales y sus señales, pero ningún dato de espectadores.
              </p>
              <p className="mt-2">
                Así que este ranking se construye con las reproducciones reales de esta plataforma, y
                empieza vacío. Inventarlo a partir de la calidad de la señal o del tamaño del canal
                sería presentar una suposición como si fuera audiencia.
              </p>
            </div>
            <SectionHeader
              title="Mientras tanto"
              subtitle="Canales comprobados y listos para ver, sin ordenar por audiencia"
              action={
                <Link href="/tv" className="focus-ring text-sm text-brand-400 hover:underline">
                  Ver todos
                </Link>
              }
            />
            <ChannelList channels={fallbackChannels} />
          </div>
        )}
      </section>
    </div>
  );
}
