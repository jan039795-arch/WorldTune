'use client';

import { useState } from 'react';
import type { Playable } from '@/lib/playable';
import { usePlayer } from '@/lib/player-store';

/** Boton grande de reproduccion de la ficha. */
export function PlayHero({ item }: { item: Playable | null }) {
  const current = usePlayer((state) => state.current);
  const status = usePlayer((state) => state.status);
  const play = usePlayer((state) => state.play);
  const playing = current?.id === item?.id && status === 'playing';

  if (!item) {
    return (
      <p className="chip" role="status">
        Sin señal reproducible en el navegador
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => play(item)}
      className="focus-ring inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-medium text-ink-950 transition hover:bg-brand-400"
    >
      {playing ? (
        <>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <rect x="3.5" y="2.5" width="3.5" height="11" rx="1" />
            <rect x="9" y="2.5" width="3.5" height="11" rx="1" />
          </svg>
          Pausar
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M4.5 2.8v10.4c0 .6.7 1 1.2.6l8-5.2c.5-.3.5-1 0-1.3l-8-5.2c-.5-.3-1.2 0-1.2.7z" />
          </svg>
          Escuchar en directo
        </>
      )}
    </button>
  );
}

/**
 * Reporte de enlace caido. El catalogo es comunitario: un clic aqui vale mas que
 * cualquier comprobacion automatica, porque el usuario sabe lo que acaba de oir.
 */
export function ReportButton({ kind, id }: { kind: 'station' | 'channel'; id: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (state === 'sent') {
    return (
      <p className="chip" role="status">
        Gracias, lo revisaremos
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={state === 'sending'}
      onClick={async () => {
        setState('sending');
        try {
          const response = await fetch('/api/v1/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kind, id, reason: 'no suena' }),
          });
          setState(response.ok ? 'sent' : 'error');
        } catch {
          setState('error');
        }
      }}
      className="focus-ring chip transition hover:text-ink-100 disabled:opacity-50"
    >
      {state === 'error' ? 'No se pudo enviar' : 'Reportar que no suena'}
    </button>
  );
}
