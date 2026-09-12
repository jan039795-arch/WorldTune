import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

/** Favoritos locales. El mismo formato que usa la web, listo para sincronizar. */

const KEY = 'worldtune.favorites';

export interface Favorite {
  kind: 'station' | 'channel';
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  addedAt: number;
}

export async function readFavorites(): Promise<Favorite[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as Favorite[]) : [];
  } catch {
    return [];
  }
}

export async function toggleFavorite(entry: Omit<Favorite, 'addedAt'>): Promise<boolean> {
  const list = await readFavorites();
  const index = list.findIndex((item) => item.id === entry.id && item.kind === entry.kind);
  if (index >= 0) {
    list.splice(index, 1);
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
    return false;
  }
  list.unshift({ ...entry, addedAt: Date.now() });
  await AsyncStorage.setItem(KEY, JSON.stringify(list.slice(0, 500)));
  return true;
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Favorite[] | null>(null);

  const refresh = useCallback(() => {
    void readFavorites().then(setFavorites);
  }, []);

  useEffect(refresh, [refresh]);

  const toggle = useCallback(
    async (entry: Omit<Favorite, 'addedAt'>) => {
      const active = await toggleFavorite(entry);
      refresh();
      return active;
    },
    [refresh],
  );

  return { favorites, toggle, refresh };
}
