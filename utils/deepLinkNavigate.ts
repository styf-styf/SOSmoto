import { router } from 'expo-router';
import { markProductoServicioStacksForReset } from './productoServicioStackReset';

// Usado por las 4 pantallas resolutoras (app/{post,ad,product,service}/[id].tsx)
// y por app/index.tsx (retomar link pendiente tras login) para aterrizar en
// el destino de un deep link con una pila de navegación limpia.
//
// Un solo `router.replace(target)` no alcanza: si el usuario ya había
// entrado por otro link antes (o probó varios seguidos), cada resolver solo
// reemplaza SU PROPIA entrada -- lo que ya se había acumulado en la pila de
// navegaciones anteriores queda debajo sin limpiar, y el botón "atrás" va
// juntando pantallas de links previos en vez de volver a Inicio.
// `dismissAll()` descarta toda esa pila acumulada (no-op seguro si no hay
// nada que descartar), `replace(prefix)` aterriza limpio en Inicio, y recién
// ahí se hace `push` al destino real -- así el único camino de "atrás" que
// existe es Inicio.
export function navigateToDeepLinkTarget(prefix: '/(client)' | '/(business)', screen: string, id: string) {
  try {
    router.dismissAll();
  } catch {
    // No había pila que descartar -- perfectamente normal (ej. primer launch en frío).
  }
  router.replace(prefix);
  if (screen.includes('producto') || screen.includes('servicio')) {
    // producto/servicio viven en su propio Stack anidado dentro de (tabs)
    // (ver (tabs)/_layout.tsx) que persiste aunque se navegue a Inicio --
    // sin este flag, ese Stack anidado podría conservar items visitados
    // antes de este link.
    markProductoServicioStacksForReset();
  }
  router.push(`${prefix}/${screen}/${id}`);
}
