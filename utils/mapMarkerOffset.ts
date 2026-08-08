import { distanceKm } from './distance';

// Cuando dos marcadores (cliente y negocio) están en la misma coordenada o
// casi (común en pruebas con los dos celulares en el mismo cuarto, pero
// también puede pasar en producción si alguien está justo afuera del
// taller), el <Marker anchor={{x:0.5,y:1}}> de react-native-maps los ancla
// al mismo pixel del mapa y el de mayor zIndex tapa completamente al otro.
// Esto los separa un poco en diagonal (horizontal Y vertical) para que se
// vean uno al lado del otro en vez de superpuestos.
const OVERLAP_THRESHOLD_METERS = 15;
const OFFSET_METERS = 12;
const METERS_PER_DEG_LAT = 111320;

export function separateOverlappingCoords<T extends { latitude: number; longitude: number }>(
  a: T,
  b: T
): [T, T] {
  const distMeters = distanceKm(a.latitude, a.longitude, b.latitude, b.longitude) * 1000;
  if (distMeters > OVERLAP_THRESHOLD_METERS) return [a, b];

  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((a.latitude * Math.PI) / 180);
  const dLat = OFFSET_METERS / 2 / METERS_PER_DEG_LAT;
  const dLng = OFFSET_METERS / 2 / metersPerDegLng;

  return [
    { ...a, latitude: a.latitude - dLat, longitude: a.longitude - dLng },
    { ...b, latitude: b.latitude + dLat, longitude: b.longitude + dLng },
  ];
}
