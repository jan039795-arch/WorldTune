'use client';

import { create } from 'zustand';
import type { Playable } from './playable';

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayerState {
  current: Playable | null;
  status: PlayerStatus;
  error: string | null;
  volume: number;
  muted: boolean;
  /** Texto que anuncia la emisora ("artista - cancion"), si lo publica. */
  nowPlaying: string | null;
  /** Minutos restantes del temporizador de apagado, o null. */
  sleepMinutes: number | null;

  play: (item: Playable) => void;
  toggle: () => void;
  stop: () => void;
  setStatus: (status: PlayerStatus, error?: string | null) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setNowPlaying: (text: string | null) => void;
  setSleep: (minutes: number | null) => void;
}

const VOLUME_KEY = 'worldtune.volume';

function storedVolume(): number {
  if (typeof window === 'undefined') return 0.85;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    const value = raw === null ? NaN : Number.parseFloat(raw);
    return Number.isFinite(value) ? Math.min(Math.max(value, 0), 1) : 0.85;
  } catch {
    return 0.85;
  }
}

/**
 * Estado global del reproductor. Vive en un store y no en un componente porque
 * la barra inferior esta montada en el layout raiz: al navegar entre paginas el
 * audio no se corta, que es la diferencia entre una radio usable y un juguete.
 */
export const usePlayer = create<PlayerState>((set, get) => ({
  current: null,
  status: 'idle',
  error: null,
  volume: storedVolume(),
  muted: false,
  nowPlaying: null,
  sleepMinutes: null,

  play: (item) => {
    const { current, status } = get();
    if (current?.id === item.id && status === 'playing') {
      set({ status: 'paused' });
      return;
    }
    set({ current: item, status: 'loading', error: null, nowPlaying: null });
  },

  toggle: () => {
    const { status, current } = get();
    if (!current) return;
    if (status === 'playing') set({ status: 'paused' });
    else set({ status: 'loading', error: null });
  },

  stop: () => set({ current: null, status: 'idle', error: null, nowPlaying: null }),

  setStatus: (status, error = null) => set({ status, error }),

  setVolume: (volume) => {
    const clamped = Math.min(Math.max(volume, 0), 1);
    try {
      window.localStorage.setItem(VOLUME_KEY, String(clamped));
    } catch {
      // modo privado: el volumen solo durara esta sesion
    }
    set({ volume: clamped, muted: clamped === 0 ? true : false });
  },

  toggleMute: () => set((state) => ({ muted: !state.muted })),
  setNowPlaying: (nowPlaying) => set({ nowPlaying }),
  setSleep: (sleepMinutes) => set({ sleepMinutes }),
}));
