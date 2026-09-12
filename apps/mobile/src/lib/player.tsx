import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { resolveStreamUrl } from '@worldtune/api-client';
import { api } from './api';

/**
 * Reproducción de radio en la app.
 *
 * Toda la interacción con el motor de audio pasa por aquí a propósito: hoy es
 * expo-audio (primera parte, garantizado compatible con el SDK) y el día que
 * hagan falta controles de pantalla de bloqueo, Android Auto o CarPlay, se
 * sustituye por react-native-track-player tocando solo este archivo.
 *
 * Diferencia con la web: aquí NO se usa el relay. Una app nativa puede abrir
 * http:// directamente, así que se reproduce el origen y no gastamos ancho de
 * banda propio.
 */

export interface NowPlaying {
  id: string;
  name: string;
  slug: string;
  subtitle: string | null;
  logoUrl: string | null;
  streamUrl: string;
}

type Status = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayerContextValue {
  current: NowPlaying | null;
  status: Status;
  error: string | null;
  play: (input: {
    id: string;
    name: string;
    slug: string;
    subtitle?: string | null;
    logoUrl?: string | null;
    streamUrl: string | null;
    needsProxy: boolean;
  }) => void;
  toggle: () => void;
  stop: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const [current, setCurrent] = useState<NowPlaying | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  // Sonar con la pantalla apagada y respetar el interruptor de silencio del iPhone
  // (una radio que se calla al bloquear el teléfono no sirve para nada).
  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {
      // en web esta llamada no existe: la reproducción sigue funcionando
    });
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);

  const play = useCallback<PlayerContextValue['play']>((input) => {
    const url = resolveStreamUrl(
      { streamUrl: input.streamUrl, needsProxy: input.needsProxy },
      { platform: 'native' },
    );
    if (!url) {
      setError('Esta emisora no tiene una señal utilizable.');
      setStatus('error');
      return;
    }

    // Pulsar la emisora que ya suena es pausar.
    if (current?.id === input.id && status === 'playing') {
      playerRef.current?.pause();
      setStatus('paused');
      return;
    }

    setError(null);
    setStatus('loading');
    setCurrent({
      id: input.id,
      name: input.name,
      slug: input.slug,
      subtitle: input.subtitle ?? null,
      logoUrl: input.logoUrl ?? null,
      streamUrl: url,
    });

    try {
      playerRef.current?.remove();
      const player = createAudioPlayer({ uri: url });
      playerRef.current = player;
      player.play();
      setStatus('playing');
      // Devolver la señal de escucha a Radio Browser, igual que hace la web.
      void api.reportPlay(input.id);
    } catch {
      setStatus('error');
      setError('No se pudo abrir la señal.');
    }
  }, [current, status]);

  const toggle = useCallback(() => {
    const player = playerRef.current;
    if (!player || !current) return;
    if (status === 'playing') {
      player.pause();
      setStatus('paused');
    } else {
      player.play();
      setStatus('playing');
    }
  }, [current, status]);

  const stop = useCallback(() => {
    playerRef.current?.remove();
    playerRef.current = null;
    setCurrent(null);
    setStatus('idle');
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ current, status, error, play, toggle, stop }),
    [current, status, error, play, toggle, stop],
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer necesita estar dentro de PlayerProvider');
  return context;
}
