import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChannelSummary, CountrySummary, GenreSummary } from '@worldtune/api-client';
import { Chips } from '@/components/Chips';
import { Empty, Screen, SectionTitle } from '@/components/Screen';
import { api } from '@/lib/api';
import { radius, spacing, theme } from '@/lib/theme';

/** Pantalla de televisión: mismos filtros que radio, pero el vídeo se abre en su ficha. */
export default function TvScreen() {
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [categories, setCategories] = useState<GenreSummary[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.countries('tv'), api.genres('tv')])
      .then(([countryResponse, genreResponse]) => {
        setCountries(countryResponse.data.slice(0, 40));
        setCategories(genreResponse.data);
      })
      .catch(() => setError('No se pudo cargar el catálogo.'));
  }, []);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const response = await api.channels({
          country: country ?? undefined,
          genre: category ?? undefined,
          page: targetPage,
          limit: 30,
        });
        setChannels((previous) =>
          targetPage === 1 ? response.data : [...previous, ...response.data],
        );
        setNextPage(response.nextPage);
        setError(null);
      } catch {
        setError('No se pudo cargar la lista.');
      } finally {
        setLoading(false);
      }
    },
    [country, category],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <Screen>
      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChannelRow channel={item} />}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (nextPage && !loading) void load(nextPage);
        }}
        ListHeaderComponent={
          <View>
            <SectionTitle hint="Señales públicas de cada emisor">País</SectionTitle>
            <Chips
              activeKey={country ?? 'todos'}
              onSelect={(key) => setCountry(key === 'todos' ? null : key)}
              items={[
                { key: 'todos', label: 'Todos' },
                ...countries.map((item) => ({
                  key: item.code,
                  label: item.nameEs ?? item.name,
                  count: item.count,
                })),
              ]}
            />
            <SectionTitle>Categoría</SectionTitle>
            <Chips
              activeKey={category ?? 'todos'}
              onSelect={(key) => setCategory(key === 'todos' ? null : key)}
              items={[
                { key: 'todos', label: 'Todas' },
                ...categories.map((item) => ({
                  key: item.slug,
                  label: item.nameEs,
                  count: item.count,
                })),
              ]}
            />
            <SectionTitle hint={error ?? undefined}>Canales</SectionTitle>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.brand} style={styles.loader} />
          ) : (
            <Empty>{error ?? 'No hay canales con estos filtros.'}</Empty>
          )
        }
      />
    </Screen>
  );
}

function ChannelRow({ channel }: { channel: ChannelSummary }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.row}
      accessibilityRole="link"
      onPress={() => router.push({ pathname: '/canal/[slug]', params: { slug: channel.slug } })}
    >
      {channel.logoUrl ? (
        <Image source={{ uri: channel.logoUrl }} style={styles.logo} contentFit="contain" />
      ) : (
        <View style={[styles.logo, styles.logoFallback]}>
          <Text style={styles.logoText}>{channel.name.slice(0, 2).toUpperCase()}</Text>
        </View>
      )}
      <View style={styles.texts}>
        <Text numberOfLines={1} style={styles.name}>
          {channel.name}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {[channel.network ?? channel.place, channel.quality].filter(Boolean).join(' · ') ||
            'Sin datos'}
        </Text>
      </View>
      {!channel.webPlayable && <Text style={styles.tag}>Solo en su sitio</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  loader: { marginVertical: spacing.xl },
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
  logo: { width: 48, height: 48, borderRadius: radius.sm, backgroundColor: theme.surfaceHi },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoText: { color: theme.textDim, fontWeight: '600' },
  texts: { flex: 1 },
  name: { color: theme.text, fontSize: 15, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  tag: { color: theme.textDim, fontSize: 11 },
});
