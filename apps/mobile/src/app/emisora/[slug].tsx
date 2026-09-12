import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { StationDetail } from '@worldtune/api-client';
import { Empty, Screen, SectionTitle } from '@/components/Screen';
import { StationRow } from '@/components/StationRow';
import { api } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { usePlayer } from '@/lib/player';
import { radius, spacing, theme } from '@/lib/theme';

/** Ficha de emisora: reproducir, guardar, ver parecidas e ir al sitio oficial. */
export default function StationScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [detail, setDetail] = useState<StationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { current, status, play } = usePlayer();
  const { favorites, toggle } = useFavorites();

  useEffect(() => {
    if (!slug) return;
    setDetail(null);
    void api
      .station(slug)
      .then(setDetail)
      .catch(() => setError('No se pudo cargar la emisora.'));
  }, [slug]);

  if (error) return <Screen><Empty>{error}</Empty></Screen>;
  if (!detail) {
    return (
      <Screen>
        <ActivityIndicator color={theme.brand} style={styles.loader} />
      </Screen>
    );
  }

  const { station } = detail;
  const best = detail.streams[0] ?? null;
  const playing = current?.id === station.id && status === 'playing';
  const isFavorite = favorites?.some((item) => item.id === station.id) ?? false;

  return (
    <Screen>
      <Stack.Screen options={{ title: station.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {station.logoUrl ? (
            <Image source={{ uri: station.logoUrl }} style={styles.logo} contentFit="cover" />
          ) : (
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoText}>{station.name.slice(0, 2).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.headerTexts}>
            <Text style={styles.name}>{station.name}</Text>
            {station.place ? <Text style={styles.place}>{station.place}</Text> : null}
            <View style={styles.tags}>
              {station.bitrate ? <Tag>{`${station.bitrate} kbps`}</Tag> : null}
              {station.codec ? <Tag>{station.codec}</Tag> : null}
              {detail.genres.map((genre) => (
                <Tag key={genre.slug}>{genre.nameEs}</Tag>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            style={[styles.playButton, !best && styles.playButtonDisabled]}
            disabled={!best}
            onPress={() =>
              best &&
              play({
                id: station.id,
                name: station.name,
                slug: station.slug,
                subtitle: station.place,
                logoUrl: station.logoUrl,
                streamUrl: best.resolvedUrl ?? best.url,
                needsProxy: best.needsProxy,
              })
            }
          >
            <Text style={styles.playLabel}>
              {best ? (playing ? '❚❚  Pausar' : '▶  Escuchar en directo') : 'Sin señal disponible'}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isFavorite }}
            style={styles.iconButton}
            onPress={() =>
              void toggle({
                kind: 'station',
                id: station.id,
                name: station.name,
                slug: station.slug,
                logoUrl: station.logoUrl,
              })
            }
          >
            <Text style={[styles.iconLabel, isFavorite && styles.iconLabelActive]}>★</Text>
          </Pressable>
        </View>

        {station.homepage ? (
          <Pressable onPress={() => void Linking.openURL(station.homepage!)}>
            <Text style={styles.link}>Sitio oficial de la emisora ↗</Text>
          </Pressable>
        ) : null}

        <Pressable onPress={() => void api.reportBroken('station', station.id)}>
          <Text style={styles.report}>Reportar que no suena</Text>
        </Pressable>

        {detail.similar.length > 0 ? (
          <>
            <SectionTitle hint="Mismo país y géneros en común">Emisoras parecidas</SectionTitle>
            <View style={styles.similar}>
              {detail.similar.map((item) => (
                <StationRow key={item.id} station={item} />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Tag({ children }: { children: string }) {
  return <Text style={styles.tag}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  loader: { marginTop: spacing.xl * 2 },
  header: { flexDirection: 'row', gap: spacing.lg },
  logo: { width: 88, height: 88, borderRadius: radius.md, backgroundColor: theme.surfaceHi },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoText: { color: theme.textDim, fontSize: 24, fontWeight: '700' },
  headerTexts: { flex: 1 },
  name: { color: theme.text, fontSize: 20, fontWeight: '700' },
  place: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  tag: {
    color: theme.textDim,
    fontSize: 11,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xl },
  playButton: {
    flex: 1,
    backgroundColor: theme.brand,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  playButtonDisabled: { backgroundColor: theme.surfaceHi },
  playLabel: { color: theme.brandInk, fontWeight: '700' },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { color: theme.textDim, fontSize: 20 },
  iconLabelActive: { color: theme.brand },
  link: { color: theme.brand, marginTop: spacing.lg, fontSize: 14 },
  report: { color: theme.textDim, marginTop: spacing.md, fontSize: 13 },
  similar: { gap: spacing.sm },
});
