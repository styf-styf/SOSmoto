import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { updatePushToken } from '../services/notifications';

export function usePushNotifications(userId: string | undefined) {
  useEffect(() => {
    // Expo Go (SDK 53+) no soporta push remoto; solo funciona en un dev client o build standalone.
    if (!userId || Platform.OS === 'web' || Constants.appOwnership === 'expo') return;

    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const tokenResponse = await Notifications.getExpoPushTokenAsync();
      await updatePushToken(userId, tokenResponse.data);
    })().catch((err) => console.error('push token registration error', err));
  }, [userId]);
}
