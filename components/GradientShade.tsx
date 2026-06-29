import { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';

// Sin expo-linear-gradient (evita sumar un módulo nativo nuevo y forzar otro
// build de EAS): se simula el degradado apilando muchas bandas finas con una
// curva de opacidad no lineal -- más bandas y pasos de opacidad más chicos
// que una progresión lineal evitan que se note el "escalón" entre bandas.
const BAND_COUNT = 24;
const DEFAULT_MAX_OPACITY = 0.62;
const CURVE_EXPONENT = 1.8;

function buildOpacities(maxOpacity: number) {
  return Array.from({ length: BAND_COUNT }, (_, i) => Math.pow(i / (BAND_COUNT - 1), CURVE_EXPONENT) * maxOpacity);
}

export function GradientShade({
  height,
  position = 'bottom',
  maxOpacity = DEFAULT_MAX_OPACITY,
  color = '#000',
  style,
}: {
  height: number;
  position?: 'top' | 'bottom';
  maxOpacity?: number;
  // Por defecto simula una sombra (bandas negras). Para fundir dos fondos de
  // color distinto (ej. blanco -> gris entre el header y la primera tarjeta
  // sin imagen) se pasa el color del fondo de arriba en vez del negro.
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  // Para la sombra de arriba se invierte la curva: la banda más oscura debe
  // quedar pegada al borde superior (en vez del inferior) para que se vea
  // como una sombra que "cae" hacia adentro de la tarjeta.
  const opacities = useMemo(() => {
    const base = buildOpacities(maxOpacity);
    return position === 'top' ? base.reverse() : base;
  }, [maxOpacity, position]);
  return (
    <View
      pointerEvents="none"
      style={[styles.container, position === 'top' ? styles.top : styles.bottom, { height }, style]}
    >
      {opacities.map((opacity, index) => (
        <View key={index} style={[styles.band, { opacity, backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'column',
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
  band: {
    flex: 1,
    backgroundColor: '#000',
  },
});
