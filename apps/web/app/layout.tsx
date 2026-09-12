import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';
import { Header } from '@/components/Header';
import { PlayerBar } from '@/components/PlayerBar';

export const metadata: Metadata = {
  title: {
    default: 'WorldTune — radio y televisión en línea de todo el mundo',
    template: '%s · WorldTune',
  },
  description:
    'Escucha miles de emisoras de radio y ve canales de televisión en línea de todo el mundo, organizados por país, estado, ciudad y género.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  openGraph: { type: 'website', locale: 'es_MX', siteName: 'WorldTune' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a
          href="#contenido"
          className="focus-ring sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-500 focus:px-3 focus:py-2 focus:text-ink-950"
        >
          Saltar al contenido
        </a>
        <Header />
        <main id="contenido" className="mx-auto max-w-6xl px-4 py-6">
          {children}
        </main>
        <footer
          className="mx-auto max-w-6xl border-t px-4 py-8 text-xs text-ink-500"
          style={{ borderColor: 'var(--border)' }}
        >
          <p>
            Catálogo de radio de{' '}
            <a
              href="https://api.radio-browser.info"
              className="underline hover:text-ink-300"
              rel="noreferrer noopener"
              target="_blank"
            >
              Radio Browser
            </a>{' '}
            y de televisión de{' '}
            <a
              href="https://github.com/iptv-org/api"
              className="underline hover:text-ink-300"
              rel="noreferrer noopener"
              target="_blank"
            >
              iptv-org
            </a>
            . WorldTune enlaza señales públicas: no las almacena, no las graba y no las modifica.
          </p>
          <p className="mt-2">
            <Link href="/aviso-legal" className="underline hover:text-ink-300">
              Aviso legal y retirada de contenidos
            </Link>
          </p>
        </footer>
        {/* Montado aqui a proposito: el layout no se desmonta al navegar. */}
        <PlayerBar />
      </body>
    </html>
  );
}
