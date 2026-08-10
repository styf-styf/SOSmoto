import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

export interface SegmentedTabItem<T extends string> {
  key: T;
  label: string;
  // Oculta la pestaña sin desarmar el layout de las demás (ej. "Citas" e
  // "Informes" no existen para tienda) -- mismo motivo que href:null en la
  // tab bar de React Navigation, pero acá es una fila propia dentro de la
  // pantalla, no una pestaña real de navegación.
  hidden?: boolean;
  showDot?: boolean;
}

// Fila de pestañas dentro de una pantalla (no es la tab bar de navegación)
// -- usada por los perfiles de cliente (con cuenta y externo) para separar
// Citas/Pedidos/Informes/Historial. Antes de extraer esto, ya se había
// repetido una vez con el mismo bloque de estilos copiado.
export function SegmentedTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: SegmentedTabItem<T>[];
  active: T;
  onChange: (key: T) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.tabsRow}>
      {tabs
        .filter((tab) => !tab.hidden)
        .map((tab) => (
          <Pressable
            key={tab.key}
            style={[styles.tabButton, active === tab.key && styles.tabButtonActive]}
            onPress={() => onChange(tab.key)}
          >
            <View style={styles.tabButtonLabelRow}>
              <Text style={[styles.tabButtonText, active === tab.key && styles.tabButtonTextActive]}>
                {tab.label}
              </Text>
              {tab.showDot && <View style={styles.tabDot} />}
            </View>
          </Pressable>
        ))}
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    tabsRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
      marginBottom: -1,
    },
    tabButtonActive: {
      borderBottomColor: colors.primary,
    },
    tabButtonLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    tabButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    tabButtonTextActive: {
      color: colors.primary,
    },
    tabDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: colors.sos,
    },
  });
}
