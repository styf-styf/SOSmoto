import { router } from 'expo-router';
import { markProductoServicioStacksForReset } from './productoServicioStackReset';

// Usado por las 4 pantallas resolutoras (app/{post,ad,product,service}/[id].tsx)
// y por app/index.tsx (retomar link pendiente tras login) para aterrizar
// directo en el destino de un deep link, sin pasar por Inicio ni por lo que
// hubiera abierto antes.
//
// Antes esto pasaba primero por Inicio (`replace(prefix)` + `push(target)`)
// para que el botón "atrás" tuviera adónde ir -- pero Inicio dispara sus
// propias cargas de fondo (feed, anuncios, mensajes) apenas se monta, sin
// que el usuario llegue a verlo, compitiendo por red/CPU justo con la carga
// del contenido que sí pidió ver. Ahora se salta ese paso: `dismissAll()`
// descarta toda pila acumulada de links anteriores (no-op seguro si no hay
// nada que descartar) y `replace(target)` aterriza directo en el contenido.
// El botón de regreso ya no tiene Inicio debajo en la pila -- eso se resuelve
// en AppHeader.tsx, que manda a Inicio cuando no hay a dónde volver.
export function navigateToDeepLinkTarget(prefix: '/(client)' | '/(business)', screen: string, id: string) {
  try {
    router.dismissAll();
  } catch {
    // No había pila que descartar -- perfectamente normal (ej. primer launch en frío).
  }
  if (screen.includes('producto') || screen.includes('servicio')) {
    // producto/servicio viven en su propio Stack anidado dentro de (tabs)
    // (ver (tabs)/_layout.tsx) que persiste entre visitas -- sin este flag,
    // ese Stack anidado podría conservar items visitados antes de este link.
    markProductoServicioStacksForReset();
  }
  // encodeURIComponent en el id -- sin esto, un id con "/" insertaria
  // segmentos de ruta extra y navegaria en silencio a otra pantalla en vez
  // de fallar limpio.
  router.replace(`${prefix}/${screen}/${encodeURIComponent(id)}`);
}
