import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StationSummary } from '@worldtune/api-client';
import { usePlayer } from '@/lib/player';
import { radius, spacing, theme } from '@/lib/theme';

/**
 * Fila de emisora. Tocar la carátula reproduce al instante; tocar el texto abre
 * la ficha. Esa separación evita el error clásico de tener que entrar a una
 * pantalla para poder escuchar.
 */
export function StationRow({ station }: { station: StationSummary }) {
  const router = useRouter();
  const { current, status, play } = usePlayer();
  const isCurrent = current?.id === station.id;
  const isPlaying = isCurrent && status === 'playing';

  return (
    <View style={[styles.row, isCurrent && styles.rowActive]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? `Pausar ${station.name}` : `Reproducir ${station.name}`}
        onPress={() =>
          play({
            id: station.id,
            name: station.name,
            slug: station.slug,
            subtitle: station.place,
            logoUrl: station.logoUrl,
            streamUrl: station.streamUrl,
            needsProxy: station.needsProxy,
          })
        }
        style={styles.artwork}
      >
        {station.logoUrl ? (
          <Image source={{ uri: station.logoUrl }} style={styles.logo} contentFit="cover" />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoText}>{station.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.overlay}>
          <Text style={styles.overlayIcon}>{isPlaying ? '❚❚' : '▶'}</Text>
        </View>
      </Pressable>

      <Pressable
        style={styles.texts}
        accessibilityRole="link"
        onPress={() => router.push({ pathname: '/emisora/[slug]', params: { slug: station.slug } })}
      >
        <Text numberOfLines={1} style={styles.name}>
          {station.name}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[station.place, station.bitrate ? `${station.bitrate} kbps` : null]
            .filter(Boolean)
            .join(' · ') || 'Sin ubicación'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  rowActive: { borderColor: theme.brand },
  artwork: { width: 48, height: 48 },
  logo: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: theme.surfaceHi },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoText: { color: theme.textDim, fontWeight: '600' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,16,32,0.45)',
    borderRadius: radius.sm,
  },
  overlayIcon: { color: theme.text, fontSize: 13, fontWeight: '700' },
  texts: { flex: 1 },
  name: { color: theme.text, fontSize: 15, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
});
