import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Empty, Screen } from '@/components/Screen';
import { useFavorites, type Favorite } from '@/lib/favorites';
import { radius, spacing, theme } from '@/lib/theme';

/** Favoritos guardados en el teléfono, sin necesidad de cuenta. */
export default function FavoritesScreen() {
  const { favorites, toggle, refresh } = useFavorites();

  // Al volver de una ficha donde se acaba de marcar algo, la lista se repinta.
  useFocusEffect(useCallback(() => refresh(), [refresh]));

  return (
    <Screen>
      <FlatList
        data={favorites ?? []}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => <Row entry={item} onRemove={() => void toggle(item)} />}
        ListEmptyComponent={
          <Empty>Todavía no has guardado nada. Usa la estrella en cualquier ficha.</Empty>
        }
      />
    </Screen>
  );
}

function Row({ entry, onRemove }: { entry: Favorite; onRemove: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.main}
        onPress={() =>
          router.push(
            entry.kind === 'station'
              ? { pathname: '/emisora/[slug]', params: { slug: entry.slug } }
              : { pathname: '/canal/[slug]', params: { slug: entry.slug } },
          )
        }
      >
        {entry.logoUrl ? (
          <Image source={{ uri: entry.logoUrl }} style={styles.logo} contentFit="cover" />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoText}>{entry.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.texts}>
          <Text numberOfLines={1} style={styles.name}>
            {entry.name}
          </Text>
          <Text style={styles.kind}>{entry.kind === 'station' ? 'Radio' : 'Televisión'}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`Quitar ${entry.name}`}
      >
        <Text style={styles.remove}>Quitar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.sm },
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
  main: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  logo: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: theme.surfaceHi },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoText: { color: theme.textDim, fontWeight: '600' },
  texts: { flex: 1 },
  name: { color: theme.text, fontSize: 15, fontWeight: '600' },
  kind: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  remove: { color: theme.textDim, fontSize: 13 },
});
