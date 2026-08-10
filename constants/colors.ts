import { shade, tint } from '../utils/color';

// 11 tokens elegidos a mano por tema -- el resto (ver buildTheme abajo) sale
// de una fórmula fija a partir de estos. Plan v2 de modo oscuro: menos
// decisiones de diseño que mantener, mismo resultado visual que elegir los
// 18 a mano.
const lightBase = {
  primary: '#FF6B00',
  secondary: '#1A1A2E',
  background: '#FFFFFF',
  surface: '#F5F5F7',
  text: '#1A1A2E',
  textMuted: '#6B6B7B',
  border: '#E5E5EA',
  success: '#2E7D32',
  warning: '#ED6C02',
  danger: '#D32F2F',
  // Verde brillante para indicadores de "confirmado/listo" tipo caja con
  // borde (ej. ubicación GPS confirmada) -- distinto del success muted de
  // arriba a propósito, es un tono más moderno para ese caso puntual. Se
  // mantiene independiente en la fórmula (nunca alias de success).
  confirmedGreen: '#22C55E',
};

const darkBase = {
  primary: '#FF8A3D',
  secondary: '#C7C9E0',
  background: '#121218',
  surface: '#1B1B24',
  text: '#EDEDF4',
  textMuted: '#9A9BB0',
  border: '#2C2D3A',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#F87171',
  confirmedGreen: '#22C55E',
};

// primaryDark oscurece el acento en tema claro (pressed state más oscuro) y
// lo aclara en tema oscuro (oscurecerlo se vería apagado sobre fondo oscuro).
function buildTheme(base: typeof lightBase, isDark: boolean) {
  return {
    ...base,
    primaryDark: shade(base.primary, isDark ? -0.2 : 0.2),
    sos: base.danger,
    successLight: tint(base.success, 0.1, base.background),
    warningLight: tint(base.warning, 0.1, base.background),
    dangerLight: tint(base.danger, 0.1, base.background),
    confirmedGreenBg: tint(base.confirmedGreen, 0.08, base.background),
    // Texto legible sobre confirmedGreenBg: se oscurece en tema claro (texto
    // oscuro sobre fondo pastel claro) y se aclara en tema oscuro (texto
    // claro sobre fondo pastel oscuro) -- mismo principio que primaryDark.
    confirmedGreenText: shade(base.confirmedGreen, isDark ? -0.5 : 0.55),
  };
}

export const lightColors = buildTheme(lightBase, false);
export const darkColors = buildTheme(darkBase, true);

export type ColorTheme = typeof lightColors;

// Alias del tema claro -- mantiene funcionando sin cambios los ~114 archivos
// que hoy importan `colors` directo en su propio StyleSheet.create(). La
// migración a modo oscuro de cada pantalla pasa por reemplazar ese import
// por `useColors()` (ver hooks/ThemeContext.tsx), no por tocar este alias.
export const colors = lightColors;
