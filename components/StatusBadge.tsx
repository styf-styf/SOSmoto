import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

// Antes cada pantalla con badges de estado (citas, agenda, compras, pedidos)
// repetía a mano el mismo trio bg-pastel/texto-saturado con hex sueltos --
// con valores que a veces no coincidían entre pantallas para el mismo
// concepto. Este componente centraliza esa forma; cada pantalla solo
// necesita mapear su propio enum de estado a uno de estos 4 tonos.
export type StatusBadgeTone = 'success' | 'pending' | 'danger' | 'neutral';

function toneStyles(colors: ColorTheme): Record<StatusBadgeTone, { bg: string; text: string }> {
  return {
    success: { bg: colors.successLight, text: colors.success },
    pending: { bg: colors.warningLight, text: colors.primary },
    danger: { bg: colors.dangerLight, text: colors.danger },
    neutral: { bg: colors.surface, text: colors.textMuted },
  };
}

export function StatusBadge({ label, tone }: { label: string; tone: StatusBadgeTone }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(), []);
  const { bg, text } = useMemo(() => toneStyles(colors)[tone], [colors, tone]);
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

function createStyles() {
  return StyleSheet.create({
    badge: {
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    text: {
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
