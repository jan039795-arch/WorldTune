import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Aviso legal y retirada de contenidos',
  description:
    'Cómo funciona WorldTune, de dónde vienen los datos y cómo solicitar la retirada de una emisora o canal.',
};

export default function LegalPage() {
  return (
    <article className="prose-sm max-w-2xl space-y-6 text-sm leading-relaxed text-ink-300">
      <h1 className="text-2xl font-semibold tracking-tight text-ink-100">
        Aviso legal y retirada de contenidos
      </h1>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-ink-100">Qué hace esta web</h2>
        <p>
          WorldTune es un directorio. Enlaza señales de radio y televisión que las propias emisoras
          publican abiertamente en internet y las organiza por país, estado, ciudad y género.
        </p>
        <p>
          No almacena, no graba, no transcodifica y no elimina la publicidad de ninguna emisión. No
          aloja contenido audiovisual: al pulsar reproducir, el navegador se conecta al servidor de la
          emisora.
        </p>
        <p>
          La única excepción técnica es un <em>relay</em> de audio para emisoras que solo sirven
          <code> http://</code>: un navegador en una página segura no puede reproducirlas. Ese relay
          reenvía los bytes en directo sin guardarlos, y solo funciona con URLs que ya están en el
          catálogo.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-ink-100">De dónde vienen los datos</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Radio:{' '}
            <a
              className="underline hover:text-ink-100"
              href="https://api.radio-browser.info"
              rel="noreferrer noopener"
              target="_blank"
            >
              Radio Browser
            </a>
            , base de datos comunitaria y libre. Cada reproducción se reporta a su API para alimentar
            su ranking.
          </li>
          <li>
            Televisión:{' '}
            <a
              className="underline hover:text-ink-100"
              href="https://github.com/iptv-org/api"
              rel="noreferrer noopener"
              target="_blank"
            >
              iptv-org
            </a>
            . Se aplica siempre su lista de bloqueo: los canales retirados por reclamaciones de
            derechos de autor y los marcados como contenido adulto no se publican aquí.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-ink-100">Si eres titular de derechos</h2>
        <p>
          Si una emisora o canal aparece aquí y no quieres que se enlace, se retira. No hace falta
          discutir de fondo: basta con indicar el nombre del canal o la URL de la ficha y la retirada
          se aplica en el catálogo, no solo en la página.
        </p>
        <p>
          Contacto:{' '}
          <span className="text-ink-100">
            {process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'añade NEXT_PUBLIC_CONTACT_EMAIL al .env'}
          </span>
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-ink-100">Limitaciones conocidas</h2>
        <ul className="list-inside list-disc space-y-1">
          <li>
            Algunos canales están geobloqueados por su emisor: se marcan como tal, pero puede que no
            se vean desde tu país.
          </li>
          <li>
            Otros exigen cabeceras propias que un navegador no puede enviar; se guardan en la base pero
            no se ofrecen como reproducibles.
          </li>
          <li>
            El estado de cada señal se comprueba periódicamente, pero una emisora puede caerse en
            cualquier momento. El botón «Reportar que no suena» acelera su revisión.
          </li>
        </ul>
      </section>
    </article>
  );
}
