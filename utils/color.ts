// Deriva colores a partir de un hex base -- usado por constants/colors.ts
// para no tener que elegir a mano cada variante (primaryDark, los fondos
// "Light" de los badges, etc). Ver plan v2 de modo oscuro: 11 tokens a mano
// por tema, el resto sale de estas dos funciones.

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

// Mezcla `hex` hacia negro (amount>0, para primaryDark en tema claro) o hacia
// blanco (amount<0, para el "pressed state" más claro en tema oscuro, donde
// oscurecer el acento se vería apagado sobre un fondo ya oscuro).
export function shade(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const target = amount >= 0 ? 0 : 255;
  const factor = Math.abs(amount);
  return rgbToHex(
    r + (target - r) * factor,
    g + (target - g) * factor,
    b + (target - b) * factor
  );
}

// Mezcla `hex` hacia un fondo (blanco en tema claro, casi-negro en tema
// oscuro) para generar el "Light"/fondo pastel de un badge a partir del
// color semántico sólido, en vez de elegir un segundo hex a mano.
export function tint(hex: string, amount: number, background: string): string {
  const [r, g, b] = hexToRgb(hex);
  const [br, bg, bb] = hexToRgb(background);
  return rgbToHex(
    br + (r - br) * amount,
    bg + (g - bg) * amount,
    bb + (b - bb) * amount
  );
}
