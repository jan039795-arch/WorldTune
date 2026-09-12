'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { isHlsLike, playUrl } from '@/lib/playable';
import { usePlayer } from '@/lib/player-store';
import { StationLogo } from './StationLogo';

/**
 * Barra de reproduccion persistente. Esta montada en el layout raiz, asi que el
 * elemento <audio> sobrevive a la navegacion y el sonido no se interrumpe al
 * cambiar de pagina.
 */
export function PlayerBar() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const { current, status, error, volume, muted, nowPlaying, sleepMinutes } = usePlayer();
  const { setStatus, toggle, stop, setVolume, toggleMute, setNowPlaying, setSleep } = usePlayer();

  // --- Carga del stream -----------------------------------------------------
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;

    let cancelled = false;
    const url = playUrl(current);

    const start = async () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;

      if (isHlsLike(current.container)) {
        // hls.js primero y canPlayType despues: Chrome dice "maybe" al MIME de
        // HLS pero no sabe reproducirlo, y el <audio> falla sin explicacion.
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(url);
          hls.attachMedia(audio);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) setStatus('error', 'No se pudo cargar el stream HLS');
          });
          hlsRef.current = hls;
        } else {
          audio.src = url;
        }
      } else if (audio.src !== url) {
        audio.src = url;
      }

      try {
        await audio.play();
        if (!cancelled) setStatus('playing');
        // Se devuelve la senal de escucha a Radio Browser, que es de donde sale
        // el catalogo. Sin await: no debe retrasar la reproduccion.
        if (current.kind === 'station') {
          void fetch(`/api/v1/click?station=${current.id}`, { method: 'POST' }).catch(() => {});
        }
      } catch (playError) {
        if (cancelled) return;
        const message =
          playError instanceof DOMException && playError.name === 'NotAllowedError'
            ? 'El navegador bloqueo la reproduccion: pulsa de nuevo'
            : 'La emisora no responde';
        setStatus('error', message);
      }
    };

    if (status === 'loading') void start();
    if (status === 'paused') audio.pause();
    if (status === 'playing' && audio.paused) void audio.play().catch(() => setStatus('error'));

    return () => {
      cancelled = true;
    };
  }, [current, status, setStatus]);

  // Al cambiar de emisora hay que soltar el stream anterior de verdad.
  useEffect(() => {
    return () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [current?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  // --- Metadatos del sistema (pantalla de bloqueo, teclas multimedia) -------
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: nowPlaying ?? current.name,
      artist: nowPlaying ? current.name : (current.subtitle ?? 'WorldTune'),
      album: 'WorldTune',
      artwork: current.logoUrl ? [{ src: current.logoUrl, sizes: '512x512' }] : [],
    });
    navigator.mediaSession.playbackState = status === 'playing' ? 'playing' : 'paused';
    navigator.mediaSession.setActionHandler('play', () => usePlayer.getState().toggle());
    navigator.mediaSession.setActionHandler('pause', () => usePlayer.getState().toggle());
    navigator.mediaSession.setActionHandler('stop', () => usePlayer.getState().stop());
  }, [current, status, nowPlaying]);

  // --- "Ahora suena": solo para emisoras que publican su estado -------------
  useEffect(() => {
    if (!current || current.kind !== 'station' || status !== 'playing') return;
    let active = true;
    const fetchNowPlaying = async () => {
      try {
        const response = await fetch(`/api/v1/now-playing?station=${current.id}`);
        if (!response.ok) return;
        const data = (await response.json()) as { title?: string | null };
        if (active) setNowPlaying(data.title?.trim() || null);
      } catch {
        // sin metadatos: la ficha simplemente no los muestra
      }
    };
    void fetchNowPlaying();
    const timer = setInterval(fetchNowPlaying, 25_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [current, status, setNowPlaying]);

  // --- Temporizador de apagado ---------------------------------------------
  useEffect(() => {
    if (sleepMinutes === null) return;
    if (sleepMinutes <= 0) {
      stop();
      setSleep(null);
      return;
    }
    const timer = setTimeout(() => setSleep(sleepMinutes - 1), 60_000);
    return () => clearTimeout(timer);
  }, [sleepMinutes, stop, setSleep]);

  const playing = status === 'playing';
  const detailHref = current
    ? current.kind === 'station'
      ? `/radio/emisora/${current.slug}`
      : `/tv/canal/${current.slug}`
    : '#';

  return (
    <>
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur"
        style={{
          height: 'var(--player-height)',
          borderColor: 'var(--border)',
          background: 'color-mix(in oklab, var(--surface-raised) 92%, transparent)',
        }}
      >
        {!current ? (
          <div className="mx-auto flex h-full max-w-6xl items-center px-4 text-sm text-ink-500">
            Elige una emisora para empezar a escuchar.
          </div>
        ) : (
          <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-3 sm:gap-4 sm:px-4">
            <button
              type="button"
              onClick={toggle}
              aria-label={playing ? `Pausar ${current.name}` : `Reproducir ${current.name}`}
              className="focus-ring flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-ink-950 transition hover:bg-brand-400"
            >
              {status === 'loading' ? (
                <span className="block size-4 animate-spin rounded-full border-2 border-ink-950 border-t-transparent" />
              ) : playing ? (
                <PauseIcon />
              ) : (
                <PlayIcon />
              )}
            </button>

            <StationLogo src={current.logoUrl} name={current.name} size={40} />

            <div className="min-w-0 flex-1">
              <Link href={detailHref} className="focus-ring block truncate text-sm font-medium hover:underline">
                {current.name}
              </Link>
              <p className="truncate text-xs text-ink-500">
                {error ? (
                  <span className="text-brand-400">{error}</span>
                ) : (
                  (nowPlaying ?? current.subtitle ?? (playing ? 'En directo' : 'En pausa'))
                )}
              </p>
            </div>

            {playing && (
              <div className="hidden items-end gap-[3px] sm:flex" aria-hidden>
                {[0, 1, 2, 3].map((index) => (
                  <span
                    key={index}
                    className="eq-bar w-[3px] rounded-full bg-live-400"
                    style={{ height: 18, animationDelay: `${index * 120}ms` }}
                  />
                ))}
              </div>
            )}

            <div className="hidden items-center gap-2 sm:flex">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                className="focus-ring rounded p-1 text-ink-300 hover:text-ink-100"
              >
                {muted || volume === 0 ? <MuteIcon /> : <VolumeIcon />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={(event) => setVolume(Number.parseFloat(event.target.value))}
                aria-label="Volumen"
                className="focus-ring h-1 w-24 accent-brand-500"
              />
            </div>

            <SleepTimer minutes={sleepMinutes} onChange={setSleep} />

            <button
              type="button"
              onClick={stop}
              aria-label="Cerrar reproductor"
              className="focus-ring rounded p-1 text-ink-500 hover:text-ink-100"
            >
              <CloseIcon />
            </button>
          </div>
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {current ? `${playing ? 'Reproduciendo' : 'En pausa'}: ${current.name}` : ''}
      </p>
    </>
  );
}

function SleepTimer({
  minutes,
  onChange,
}: {
  minutes: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="hidden items-center gap-1 text-xs text-ink-500 md:flex">
      <span className="sr-only">Temporizador de apagado</span>
      <select
        value={minutes ?? ''}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number.parseInt(event.target.value, 10))
        }
        className="focus-ring rounded border bg-transparent px-1 py-0.5"
        style={{ borderColor: 'var(--border)' }}
        aria-label="Temporizador de apagado"
      >
        <option value="">Sin temporizador</option>
        <option value="15">15 min</option>
        <option value="30">30 min</option>
        <option value="60">1 h</option>
        <option value="120">2 h</option>
      </select>
      {minutes !== null && <span className="tabular-nums">{minutes}m</span>}
    </label>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M4.5 2.8v10.4c0 .6.7 1 1.2.6l8-5.2c.5-.3.5-1 0-1.3l-8-5.2c-.5-.3-1.2 0-1.2.7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <rect x="3.5" y="2.5" width="3.5" height="11" rx="1" />
      <rect x="9" y="2.5" width="3.5" height="11" rx="1" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4 8h2.5L10 4.5v11L6.5 12H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <path
        d="M13 7.2a3.6 3.6 0 0 1 0 5.6M15.2 5a6.4 6.4 0 0 1 0 10"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M4 8h2.5L10 4.5v11L6.5 12H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
      <path d="M13 8l4 4m0-4l-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
