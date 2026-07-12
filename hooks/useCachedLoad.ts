import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';

// Cache en memoria a nivel de módulo -- a diferencia de un useRef, sobrevive
// el desmontaje del componente. Las pantallas que viven en un Stack.Screen
// (no en un tab) se desmontan por completo al volver atrás; sin esta cache,
// cada visita repetiría el fetch y el spinner de pantalla completa aunque
// los datos no hayan cambiado.
const cache = new Map<string, unknown>();

export function useCachedLoad<T>(key: string | null, loadFn: () => Promise<T>) {
  const [data, setData] = useState<T | undefined>(() => (key ? (cache.get(key) as T | undefined) : undefined));
  const [loading, setLoading] = useState(() => !!key && !cache.has(key));

  const reload = useCallback(async () => {
    const result = await loadFn();
    if (key) cache.set(key, result);
    setData(result);
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFn, key]);

  // `reload` cambia de identidad en cada render (la mayoría de las pantallas
  // pasan un loadFn inline) -- si se lo pasáramos directo a useFocusEffect,
  // React Navigation re-dispara el efecto en cada render mientras la pantalla
  // está enfocada (no solo en focos reales), causando un loop de recargas.
  // Este ref siempre apunta a la versión más reciente sin ese problema.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    // Ya hay datos cacheados de una visita anterior -- no se recarga solo,
    // solo a pedido explícito del usuario (pull-to-refresh u otra acción
    // que llame a `reload()`).
    if (!key || cache.has(key)) return;
    setLoading(true);
    reloadRef
      .current()
      .catch((err) => console.error(`useCachedLoad(${key}) error`, err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Al recuperar el foco (volver de otra pantalla/tab) con datos ya
  // cacheados de una visita anterior, se refresca en segundo plano sin
  // mostrar spinner ni tocar el contenido ya visible -- se actualiza solo
  // si algo cambió mientras el usuario estaba en otra pantalla.
  useFocusEffect(
    useCallback(() => {
      if (key && cache.has(key)) {
        reloadRef.current().catch((err) => console.error(`useCachedLoad(${key}) refresh error`, err));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key])
  );

  return { data, loading, reload, setData };
}
