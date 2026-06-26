import { useEffect, useRef } from 'react';
import * as Location from 'expo-location';

export function useLiveLocationSharing(
  enabled: boolean,
  onUpdate: (coords: { latitude: number; longitude: number }) => void
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled) return;

    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 15000, distanceInterval: 30 },
        (position) => {
          onUpdateRef.current({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      );
    })().catch((err) => console.error('live location sharing error', err));

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [enabled]);
}
