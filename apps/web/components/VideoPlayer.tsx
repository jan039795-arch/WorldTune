'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Reproductor de television. A diferencia del audio, el video vive en la pagina
 * del canal y no en el layout: nadie espera que un video siga sonando mientras
 * navega, y mantenerlo montado gastaria datos a lo tonto.
 *
 * Los streams de iptv-org son casi todos HLS; algunos vienen como MPEG-TS crudo
 * y unos pocos como DASH. Cada caso necesita su motor.
 */
export function VideoPlayer({
  url,
  container,
  poster,
  title,
  channelId,
}: {
  url: string;
  container: string;
  poster?: string | null;
  title: string;
  /** Si se indica, la primera reproducción se cuenta para el ranking de TV. */
  channelId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reported = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let destroyed = false;
    let cleanup = () => {};

    const attach = async () => {
      setError(null);
      setLoading(true);

      if (container === 'mpegts') {
        try {
          const mpegts = await import('mpegts.js');
          if (destroyed) return;
          if (mpegts.default.isSupported()) {
            const player = mpegts.default.createPlayer({ type: 'mpegts', isLive: true, url });
            player.attachMediaElement(video);
            player.load();
            cleanup = () => player.destroy();
            return;
          }
        } catch {
          // sin mpegts.js instalado se intenta nativo mas abajo
        }
      }

      if (container === 'hls' || container === 'dash') {
        // Se prueba hls.js ANTES que la reproduccion nativa: Chrome responde
        // "maybe" a canPlayType('application/vnd.apple.mpegurl') y luego falla
        // con MEDIA_ELEMENT_ERROR, asi que preguntarle no sirve de nada.
        const { default: Hls } = await import('hls.js');
        if (destroyed) return;
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: true, liveDurationInfinity: true });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (!data.fatal) return;
            // La causa mas comun: el origen no envia cabeceras CORS.
            setError(
              data.type === 'networkError'
                ? 'El canal no permite reproducirse desde otro sitio web (sin CORS) o está caído.'
                : 'No se pudo decodificar la señal.',
            );
            setLoading(false);
          });
          cleanup = () => hls.destroy();
          return;
        }
      }

      video.src = url;
    };

    void attach();
    return () => {
      destroyed = true;
      cleanup();
      video.removeAttribute('src');
      video.load();
    };
  }, [url, container]);

  return (
    <div className="relative overflow-hidden rounded-xl bg-black" style={{ aspectRatio: '16 / 9' }}>
      <video
        ref={videoRef}
        controls
        playsInline
        autoPlay
        muted
        poster={poster ?? undefined}
        crossOrigin="anonymous"
        aria-label={title}
        onPlaying={() => {
          setLoading(false);
          setError(null);
          // Solo la primera vez: pausar y reanudar no es otra visualización.
          if (channelId && !reported.current) {
            reported.current = true;
            void fetch(`/api/v1/click?kind=channel&id=${encodeURIComponent(channelId)}`, {
              method: 'POST',
            }).catch(() => {});
          }
        }}
        onError={() => {
          setLoading(false);
          setError('La señal no responde.');
        }}
        className="size-full"
      />
      {(loading || error) && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center text-sm">
          {error ? (
            <p className="pointer-events-auto max-w-sm rounded-lg bg-ink-950/85 px-4 py-3 text-ink-300">
              {error}
            </p>
          ) : (
            <span className="size-8 animate-spin rounded-full border-2 border-ink-300 border-t-transparent" />
          )}
        </div>
      )}
    </div>
  );
}
