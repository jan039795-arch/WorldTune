import { Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChannelDetail } from '@worldtune/api-client';
import { Empty, Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { useFavorites } from '@/lib/favorites';
import { radius, spacing, theme } from '@/lib/theme';

/**
 * Ficha de canal de TV.
 *
 * El vídeo vive en esta pantalla y no en el reproductor global: nadie espera que
 * un canal siga consumiendo datos mientras navega por el catálogo.
 */
export default function ChannelScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [detail, setDetail] = useState<ChannelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { favorites, toggle } = useFavorites();

  useEffect(() => {
    if (!slug) return;
    setDetail(null);
    void api
      .channel(slug)
      .then(setDetail)
      .catch(() => setError('No se pudo cargar el canal.'));
  }, [slug]);

  const source = detail?.streams[0]?.resolvedUrl ?? detail?.streams[0]?.url ?? null;

  // Se cuenta una vez por canal abierto, para el ranking de television.
  useEffect(() => {
    if (!detail?.channel.id || !source) return;
    void api.reportPlay(detail.channel.id, 'channel');
  }, [detail?.channel.id, source]);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
    if (source) instance.play();
  });

  if (error) return <Screen><Empty>{error}</Empty></Screen>;
  if (!detail) {
    return (
      <Screen>
        <ActivityIndicator color={theme.brand} style={styles.loader} />
      </Screen>
    );
  }

  const { channel } = detail;
  const isFavorite = favorites?.some((item) => item.id === channel.id) ?? false;

  return (
    <Screen>
      <Stack.Screen options={{ title: channel.name }} />
      <ScrollView contentContainerStyle={styles.content}>
        {source ? (
          <VideoView
            player={player}
            style={styles.video}
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
            nativeControls
            contentFit="contain"
          />
        ) : (
          <View style={styles.noSignal}>
            <Text style={styles.noSignalTitle}>
              {channel.curated
                ? 'Este canal emite solo dentro de su propio reproductor.'
                : 'Este canal no tiene una señal abierta que se pueda reproducir aquí.'}
            </Text>
            {channel.website ? (
              <Pressable
                style={styles.officialButton}
                onPress={() => void Linking.openURL(channel.website!)}
              >
                <Text style={styles.officialLabel}>Ver en el sitio oficial ↗</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <View style={styles.header}>
          <View style={styles.headerTexts}>
            <Text style={styles.name}>{channel.name}</Text>
            <Text style={styles.meta}>
              {[channel.network, channel.place].filter(Boolean).join(' · ') || 'Sin datos'}
            </Text>
            <View style={styles.tags}>
              {detail.streams[0]?.quality ? <Tag>{detail.streams[0].quality}</Tag> : null}
              {detail.genres.map((genre) => (
                <Tag key={genre.slug}>{genre.nameEs}</Tag>
              ))}
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isFavorite }}
            style={styles.iconButton}
            onPress={() =>
              void toggle({
                kind: 'channel',
                id: channel.id,
                name: channel.name,
                slug: channel.slug,
                logoUrl: channel.logoUrl,
              })
            }
          >
            <Text style={[styles.iconLabel, isFavorite && styles.iconLabelActive]}>★</Text>
          </Pressable>
        </View>

        <Pressable onPress={() => void api.reportBroken('channel', channel.id)}>
          <Text style={styles.report}>Reportar que no se ve</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

function Tag({ children }: { children: string }) {
  return <Text style={styles.tag}>{children}</Text>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl * 2 },
  loader: { marginTop: spacing.xl * 2 },
  video: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  noSignal: { padding: spacing.lg, gap: spacing.md, backgroundColor: theme.surface },
  noSignalTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
  officialButton: {
    alignSelf: 'flex-start',
    backgroundColor: theme.brand,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  officialLabel: { color: theme.brandInk, fontWeight: '700' },
  header: { flexDirection: 'row', gap: spacing.md, padding: spacing.lg },
  headerTexts: { flex: 1 },
  name: { color: theme.text, fontSize: 20, fontWeight: '700' },
  meta: { color: theme.textDim, fontSize: 13, marginTop: 2 },
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
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconLabel: { color: theme.textDim, fontSize: 20 },
  iconLabelActive: { color: theme.brand },
  report: { color: theme.textDim, fontSize: 13, paddingHorizontal: spacing.lg },
});
