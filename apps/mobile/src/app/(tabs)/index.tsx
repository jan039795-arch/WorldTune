import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CountrySummary, GenreSummary, StationSummary } from '@worldtune/api-client';
import { Chips } from '@/components/Chips';
import { Empty, Screen, SectionTitle } from '@/components/Screen';
import { StationRow } from '@/components/StationRow';
import { api } from '@/lib/api';
import { spacing, theme } from '@/lib/theme';

/**
 * Pantalla de radio: filtros por país y género arriba, lista de emisoras abajo.
 *
 * Los filtros no navegan a otra pantalla: cambian la lista en el sitio. En un
 * teléfono, ir y volver entre pantallas para cambiar de género cansa enseguida.
 */
export default function RadioScreen() {
  const router = useRouter();
  const [countries, setCountries] = useState<CountrySummary[]>([]);
  const [genres, setGenres] = useState<GenreSummary[]>([]);
  const [country, setCountry] = useState<string | null>(null);
  const [genre, setGenre] = useState<string | null>(null);
  const [stations, setStations] = useState<StationSummary[]>([]);
  const [page, setPage] = useState(1);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void Promise.all([api.countries('radio'), api.genres('radio')])
      .then(([countryResponse, genreResponse]) => {
        setCountries(countryResponse.data.slice(0, 40));
        setGenres(genreResponse.data.slice(0, 30));
      })
      .catch(() => setError('No se pudo cargar el catálogo. ¿Está corriendo la API?'));
  }, []);

  const load = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      try {
        const response = await api.stations({
          country: country ?? undefined,
          genre: genre ?? undefined,
          page: targetPage,
          limit: 30,
        });
        setStations((previous) =>
          targetPage === 1 ? response.data : [...previous, ...response.data],
        );
        setNextPage(response.nextPage);
        setPage(targetPage);
        setError(null);
      } catch {
        setError('No se pudo cargar la lista.');
      } finally {
        setLoading(false);
      }
    },
    [country, genre],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <Screen>
      <FlatList
        data={stations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <StationRow station={item} />}
        contentContainerStyle={styles.list}
        // Paginación infinita: el catálogo tiene 58 000 emisoras, cargarlas de
        // golpe no es una opción.
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (nextPage && !loading) void load(nextPage);
        }}
        ListHeaderComponent={
          <View>
            <Pressable style={styles.search} onPress={() => router.push('/buscar')}>
              <Text style={styles.searchText}>Buscar emisora o canal…</Text>
            </Pressable>

            <SectionTitle hint="Toca para filtrar">País</SectionTitle>
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

            <SectionTitle>Género</SectionTitle>
            <Chips
              activeKey={genre ?? 'todos'}
              onSelect={(key) => setGenre(key === 'todos' ? null : key)}
              items={[
                { key: 'todos', label: 'Todos' },
                ...genres.map((item) => ({
                  key: item.slug,
                  label: item.nameEs,
                  count: item.count,
                })),
              ]}
            />

            <SectionTitle hint={error ?? undefined}>Emisoras</SectionTitle>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={theme.brand} style={styles.loader} />
          ) : (
            <Empty>{error ?? 'No hay emisoras con estos filtros.'}</Empty>
          )
        }
        ListFooterComponent={
          loading && stations.length > 0 ? (
            <ActivityIndicator color={theme.brand} style={styles.loader} />
          ) : null
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  search: {
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: 999,
    backgroundColor: theme.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  },
  searchText: { color: theme.textDim, fontSize: 14 },
  loader: { marginVertical: spacing.xl },
});
