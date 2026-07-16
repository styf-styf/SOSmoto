import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

// Antes esto simulaba el degradado apilando 24 Views sólidas con opacidad
// escalonada (para no sumar expo-linear-gradient y evitar un build nativo
// nuevo) -- el "escalón" entre bandas era inherente a ese diseño y no se
// podía eliminar del todo, solo disimular. LinearGradient interpola de
// verdad entre colores (GPU), así que ya no hay banding sin importar cuántos
// stops se usen; se conservan varios stops intermedios solo para respetar la
// misma curva de opacidad no lineal que tenía la versión anterior (más
// sutil al inicio, más marcada cerca del borde), no para tapar bandas.
const STOPS = 8;
const DEFAULT_MAX_OPACITY = 0.62;
const CURVE_EXPONENT = 1.8;

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const num = parseInt(h, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function buildColors(color: string, maxOpacity: number, reversed: boolean): [string, string, ...string[]] {
  const [r, g, b] = hexToRgb(color);
  const stops = Array.from({ length: STOPS }, (_, i) => {
    const t = i / (STOPS - 1);
    const opacity = Math.pow(t, CURVE_EXPONENT) * maxOpacity;
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  });
  const ordered = reversed ? stops.reverse() : stops;
  return ordered as [string, string, ...string[]];
}

export function GradientShade({
  height,
  position = 'bottom',
  maxOpacity = DEFAULT_MAX_OPACITY,
  // Por defecto simula una sombra (negro). Para fundir dos fondos de color
  // distinto (ej. blanco -> gris entre el header y la primera tarjeta sin
  // imagen) se pasa el color del fondo de arriba en vez del negro.
  color = '#000',
  style,
}: {
  height: number;
  position?: 'top' | 'bottom';
  maxOpacity?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  // Para la sombra de arriba se invierte la curva: el stop más oscuro debe
  // quedar pegado al borde superior (en vez del inferior) para que se vea
  // como una sombra que "cae" hacia adentro de la tarjeta.
  const colors = buildColors(color, maxOpacity, position === 'top');

  return (
    <LinearGradient
      pointerEvents="none"
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.container, position === 'top' ? styles.top : styles.bottom, { height }, style]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  top: {
    top: 0,
  },
  bottom: {
    bottom: 0,
  },
});
