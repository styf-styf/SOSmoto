import { Dimensions } from 'react-native';

// Compartido entre app/(client)/(tabs)/buscar.tsx y app/(business)/buscar.tsx.
// Math.floor (no Math.round): con Math.round, 2*ancho + gap puede superar por
// 1px el ancho real de pantalla (frecuente en Android) y ese único píxel de
// más hace que flexWrap mande la segunda tarjeta a la siguiente línea -- la
// grilla "colapsa" a 1 columna.
export function getDiscoverCardWidth(containerPadding: number, gridGap: number): number {
  const screenWidth = Dimensions.get('window').width;
  return Math.floor((screenWidth - containerPadding * 2 - gridGap) / 2);
}
