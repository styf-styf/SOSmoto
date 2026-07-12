import { useCallback, useEffect, useState } from 'react';

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

  useEffect(() => {
    // Ya hay datos cacheados de una visita anterior -- no se recarga solo,
    // solo a pedido explícito del usuario (pull-to-refresh u otra acción
    // que llame a `reload()`).
    if (!key || cache.has(key)) return;
    setLoading(true);
    reload()
      .catch((err) => console.error(`useCachedLoad(${key}) error`, err))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading, reload, setData };
}
