import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { radius, spacing, theme } from '@/lib/theme';

export interface Chip {
  key: string;
  label: string;
  count?: number;
}

/**
 * Fila horizontal de filtros (países, géneros, ciudades). En un teléfono el
 * desplazamiento lateral cabe donde una rejilla no.
 */
export function Chips({
  items,
  activeKey,
  onSelect,
}: {
  items: Chip[];
  activeKey?: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {items.map((item) => {
        const active = item.key === activeKey;
        return (
          <Pressable
            key={item.key}
            onPress={() => onSelect(item.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
              {item.label}
              {item.count !== undefined ? `  ${item.count}` : ''}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
  label: { color: theme.textDim, fontSize: 13 },
  labelActive: { color: theme.brandInk, fontWeight: '600' },
});
