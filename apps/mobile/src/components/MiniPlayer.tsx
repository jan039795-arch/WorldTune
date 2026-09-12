import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlayer } from '@/lib/player';
import { radius, spacing, theme } from '@/lib/theme';

/**
 * Barra de reproducción fija. Vive en el layout raíz, así que sobrevive a la
 * navegación entre pantallas y el audio no se corta: es el mismo principio que
 * en la web.
 */
export function MiniPlayer() {
  const { current, status, error, toggle, stop } = usePlayer();
  if (!current) return null;

  const playing = status === 'playing';

  return (
    <View style={styles.bar}>
      <Link href={{ pathname: '/emisora/[slug]', params: { slug: current.slug } }} asChild>
        <Pressable style={styles.info} accessibilityRole="link">
          {current.logoUrl ? (
            <Image source={{ uri: current.logoUrl }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoText}>{current.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.texts}>
            <Text numberOfLines={1} style={styles.name}>
              {current.name}
            </Text>
            <Text numberOfLines={1} style={styles.subtitle}>
              {error ?? current.subtitle ?? (playing ? 'En directo' : 'En pausa')}
            </Text>
          </View>
        </Pressable>
      </Link>

      <Pressable
        onPress={toggle}
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel={playing ? `Pausar ${current.name}` : `Reproducir ${current.name}`}
      >
        {status === 'loading' ? (
          <ActivityIndicator color={theme.brandInk} size="small" />
        ) : (
          <Text style={styles.buttonIcon}>{playing ? '❚❚' : '▶'}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={stop}
        style={styles.close}
        accessibilityRole="button"
        accessibilityLabel="Cerrar reproductor"
      >
        <Text style={styles.closeIcon}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  info: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  logo: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: theme.surfaceHi },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoText: { color: theme.textDim, fontSize: 13, fontWeight: '600' },
  texts: { flex: 1 },
  name: { color: theme.text, fontSize: 14, fontWeight: '600' },
  subtitle: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: theme.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: { color: theme.brandInk, fontSize: 14, fontWeight: '700' },
  close: { padding: spacing.sm },
  closeIcon: { color: theme.textDim, fontSize: 14 },
});
