import Constants from 'expo-constants';
import { WorldTuneApi } from '@worldtune/api-client';

/**
 * Dónde vive la API.
 *
 * En un teléfono `localhost` es el propio teléfono, así que en desarrollo se
 * deduce la IP de la máquina a partir del host del servidor de Expo. En una
 * compilación de producción manda EXPO_PUBLIC_API_URL.
 */
function resolveBaseUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  if (host) return `http://${host}:3000`;

  return 'http://localhost:3000';
}

export const API_BASE_URL = resolveBaseUrl();

export const api = new WorldTuneApi(API_BASE_URL, { timeoutMs: 20_000 });
