import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { RankedChannel, RankedStation } from '@worldtune/api-client';
import { Chips } from '@/components/Chips';
import { Empty, Screen, SectionTitle } from '@/components/Screen';
import { api } from '@/lib/api';
import { usePlayer } from '@/lib/player';
import { radius, spacing, theme } from '@/lib/theme';

type Source = 'listening' | 'voted';

/**
 * Rankings.
 *
 * La radio tiene audiencia mundial real: Radio Browser publica las escuchas de
 * las últimas 24 h de toda su comunidad, y aparte los votos acumulados. Son dos
 * cosas distintas y la pantalla las separa.
 *
 * La televisión no tiene nada equivalente: iptv-org no publica ningún dato de
 * espectadores, así que su top sale de las reproducciones de esta plataforma y
 * empieza vacío. La pantalla lo dice en vez de disimularlo.
 */
export default function TopScreen() {
  const [source, setSource] = useState<Source>('listening');
  const [stations, setStations] = useState<RankedStation[]>([]);
  const [channels, setChannels] = useState<RankedChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    void api
      .top(source, 10)
      .then((response) => {
        setStations(response.stations.data);
        setChannels(response.channels.data);
        setError(null);
      })
      .catch(() => setError('No se pudo cargar el ranking.'))
      .finally(() => setLoading(false));
  }, [source]);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Chips
          activeKey={source}
          onSelect={(key) => setSource(key as Source)}
          items={[
            { key: 'listening', label: 'Más escuchadas hoy' },
            { key: 'voted', label: 'Favoritas de siempre' },
          ]}
        />

        <SectionTitle
          hint={
            source === 'voted'
              ? 'Votos acumulados de la comunidad: reputación, no audiencia de hoy'
              : 'Escuchas de las últimas 24 h en toda la comunidad de Radio Browser'
          }
        >
          Top 10 mundial de radio
        </SectionTitle>

        {loading ? (
          <ActivityIndicator color={theme.brand} style={styles.loader} />
        ) : error ? (
          <Empty>{error}</Empty>
        ) : (
          <View style={styles.list}>
            {stations.map((station, index) => (
              <StationRank
                key={station.id}
                position={index + 1}
                station={station}
                metric={source === 'voted' ? station.votes : station.clickCount}
                unit={source === 'voted' ? 'votos' : 'escuchas en 24 h'}
              />
            ))}
          </View>
        )}

        <SectionTitle hint="Reproducciones contadas en WorldTune">
          Lo más visto en televisión
        </SectionTitle>

        {channels.length > 0 ? (
          <View style={styles.list}>
            {channels.map((channel, index) => (
              <ChannelRank key={channel.id} position={index + 1} channel={channel} />
            ))}
          </View>
        ) : (
          <View style={styles.note}>
            <Text style={styles.noteTitle}>Todavía no hay top de televisión.</Text>
            <Text style={styles.noteBody}>
              Para la radio existe un dato de audiencia mundial. Para la televisión no: el catálogo
              abierto publica los canales, pero ningún dato de espectadores. Este ranking se llena
              con las reproducciones reales de la plataforma; inventarlo sería presentar una
              suposición como si fuera audiencia.
            </Text>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function StationRank({
  position,
  station,
  metric,
  unit,
}: {
  position: number;
  station: RankedStation;
  metric: number;
  unit: string;
}) {
  const router = useRouter();
  const { current, status, play } = usePlayer();
  const isPlaying = current?.id === station.id && status === 'playing';

  return (
    <View style={styles.row}>
      <Text style={styles.position}>{position}</Text>
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
      >
        {station.logoUrl ? (
          <Image source={{ uri: station.logoUrl }} style={styles.logo} contentFit="cover" />
        ) : (
          <View style={[styles.logo, styles.logoFallback]}>
            <Text style={styles.logoText}>{station.name.slice(0, 2).toUpperCase()}</Text>
          </View>
        )}
      </Pressable>
      <Pressable
        style={styles.texts}
        onPress={() => router.push({ pathname: '/emisora/[slug]', params: { slug: station.slug } })}
      >
        <Text numberOfLines={1} style={styles.name}>
          {station.name}
        </Text>
        <Text numberOfLines={1} style={styles.meta}>
          {formatNumber(metric)} {unit}
          {station.place ? ` · ${station.place}` : ''}
        </Text>
      </Pressable>
    </View>
  );
}

function ChannelRank({ position, channel }: { position: number; channel: RankedChannel }) {
  const router = useRouter();
  return (
    <Pressable
      style={styles.row}
      onPress={() => router.push({ pathname: '/canal/[slug]', params: { slug: channel.slug } })}
    >
      <Text style={styles.position}>{position}</Text>
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
          {formatNumber(channel.playCount)}{' '}
          {channel.playCount === 1 ? 'reproducción' : 'reproducciones'} aquí
        </Text>
      </View>
    </Pressable>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-MX', {
    notation: value >= 10_000 ? 'compact' : 'standard',
  }).format(value);
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xl * 2 },
  loader: { marginVertical: spacing.xl },
  list: { paddingHorizontal: spacing.lg, gap: spacing.sm },
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
  position: {
    width: 20,
    textAlign: 'right',
    color: theme.textDim,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  logo: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: theme.surfaceHi },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  logoText: { color: theme.textDim, fontWeight: '600' },
  texts: { flex: 1 },
  name: { color: theme.text, fontSize: 15, fontWeight: '600' },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
  note: {
    marginHorizontal: spacing.lg,
    padding: spacing.lg,
    backgroundColor: theme.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    gap: spacing.sm,
  },
  noteTitle: { color: theme.text, fontSize: 15, fontWeight: '600' },
  noteBody: { color: theme.textDim, fontSize: 13, lineHeight: 19 },
});
