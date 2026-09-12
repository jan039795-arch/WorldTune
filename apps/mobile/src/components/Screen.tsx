import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { spacing, theme } from '@/lib/theme';

/** Contenedor de pantalla con el fondo de la marca y márgenes consistentes. */
export function Screen({ style, ...rest }: ViewProps) {
  return <View style={[styles.screen, style]} {...rest} />;
}

export function SectionTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.title}>{children}</Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Empty({ children }: { children: string }) {
  return <Text style={styles.empty}>{children}</Text>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.bg },
  section: { marginTop: spacing.xl, marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  title: { color: theme.text, fontSize: 18, fontWeight: '700' },
  hint: { color: theme.textDim, fontSize: 13, marginTop: 2 },
  empty: { color: theme.textDim, fontSize: 14, textAlign: 'center', padding: spacing.xl },
});
