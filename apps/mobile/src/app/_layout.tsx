import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StyleSheet, View } from 'react-native';
import { MiniPlayer } from '@/components/MiniPlayer';
import { PlayerProvider } from '@/lib/player';
import { theme } from '@/lib/theme';

/**
 * Layout raíz. El reproductor se monta aquí, fuera del Stack, para que la
 * reproducción sobreviva a cualquier navegación.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <StatusBar style="light" />
        <View style={styles.root}>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: theme.bg },
              headerTintColor: theme.text,
              headerTitleStyle: { fontWeight: '700' },
              contentStyle: { backgroundColor: theme.bg },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="emisora/[slug]" options={{ title: 'Emisora' }} />
            <Stack.Screen name="canal/[slug]" options={{ title: 'Canal' }} />
            <Stack.Screen name="buscar" options={{ title: 'Buscar' }} />
          </Stack>
          <SafeAreaView edges={['bottom']} style={styles.playerHolder}>
            <MiniPlayer />
          </SafeAreaView>
        </View>
      </PlayerProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  playerHolder: { backgroundColor: theme.surface },
});
