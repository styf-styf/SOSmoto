import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';

// El punto rojo de "hay algo pendiente" sobre un ícono de la tab bar estaba
// repetido -- mismo objeto de estilo carácter por carácter -- en Mensajes y
// Pedidos (negocio) y en SOS/Mensajes (cliente). Envuelve el ícono que ya
// tenía cada pestaña (Ionicons, Image de avatar, etc.) sin tocar cómo se
// arma ese ícono, solo agrega el punto encima cuando showDot es true.
export function TabIconBadge({ children, showDot }: { children: ReactNode; showDot: boolean }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View>
      {children}
      {showDot && <View style={styles.dot} />}
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    dot: {
      position: 'absolute',
      top: -2,
      right: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.sos,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
  });
}
