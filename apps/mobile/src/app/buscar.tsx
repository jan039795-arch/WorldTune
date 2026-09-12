import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Empty, Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { radius, spacing, theme } from '@/lib/theme';

interface Result {
  kind: 'station' | 'channel';
  name: string;
  slug: string;
  logoUrl: string | null;
  subtitle: string | null;
}

/** Búsqueda unificada de emisoras y canales. */
export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    // Se espera a que el usuario deje de escribir: cada pulsación sería una consulta.
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.search(query.trim(), 20);
        setResults(response.results);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Screen>
      <View style={styles.searchBox}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Emisora, canal, ciudad…"
          placeholderTextColor={theme.textDim}
          style={styles.input}
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Buscar"
        />
      </View>
      <FlatList
        data={results}
        keyExtractor={(item) => `${item.kind}-${item.slug}`}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={styles.row}
            onPress={() =>
              router.push(
                item.kind === 'station'
                  ? { pathname: '/emisora/[slug]', params: { slug: item.slug } }
                  : { pathname: '/canal/[slug]', params: { slug: item.slug } },
              )
            }
          >
            {item.logoUrl ? (
              <Image source={{ uri: item.logoUrl }} style={styles.logo} contentFit="cover" />
            ) : (
              <View style={styles.logo} />
            )}
            <View style={styles.texts}>
              <Text numberOfLines={1} style={styles.name}>
                {item.name}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {item.kind === 'station' ? 'Radio' : 'TV'}
                {item.subtitle ? ` · ${item.subtitle}` : ''}
              </Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.brand} style={styles.loader} />
          ) : query.trim().length >= 2 ? (
            <Empty>Nada coincide con esa búsqueda.</Empty>
          ) : (
            <Empty>Escribe al menos dos letras.</Empty>
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchBox: { padding: spacing.lg },
  input: {
    backgroundColor: theme.surface,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    color: theme.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl },
  loader: { marginTop: spacing.xl },
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
  logo: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: theme.surfaceHi },
  texts: { flex: 1 },
  name: { color: theme.text, fontSize: 15, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
});
