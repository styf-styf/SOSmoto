import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

interface Coords {
  latitude: number;
  longitude: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export function useLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const coordsRef = useRef<Coords | null>(null);

  const fetchCoords = useCallback(async (): Promise<Coords> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Activa el permiso de ubicación para pedir auxilio.');
    }

    try {
      const position = await withTimeout(Location.getCurrentPositionAsync({}), 8000);
      const next = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      coordsRef.current = next;
      setCoords(next);
      setError(null);
      return next;
    } catch {
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const next = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
        coordsRef.current = next;
        setCoords(next);
        setError(null);
        return next;
      }
      throw new Error('No se pudo obtener tu ubicación. Verifica que el GPS esté activado.');
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    fetchCoords()
      .catch((err) => {
        if (isCurrent) setError(err.message ?? 'No se pudo obtener tu ubicación.');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, [fetchCoords]);

  const getCoords = useCallback((): Promise<Coords> => {
    if (coordsRef.current) return Promise.resolve(coordsRef.current);
    return fetchCoords();
  }, [fetchCoords]);

  return { coords, error, loading, getCoords };
}
