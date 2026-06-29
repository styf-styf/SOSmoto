import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export function useLiveLocationSharing(
  enabled: boolean,
  onUpdate: (coords: { latitude: number; longitude: number }) => void,
  onError?: () => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!enabled) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        onErrorRef.current?.();
        return;
      }

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 30 },
        (position) => {
          onUpdateRef.current({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      );
    })().catch((err) => {
      console.error('live location sharing error', err);
      onErrorRef.current?.();
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
