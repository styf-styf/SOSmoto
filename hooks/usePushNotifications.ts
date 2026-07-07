import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { updatePushToken } from '../services/notifications';

type Role = 'client' | 'business';

function routeNotification(data: Record<string, unknown>, role: Role) {
  const type = data.type as string | undefined;
  if (!type) return;

  if (role === 'client') {
    switch (type) {
      case 'update_mileage':
      case 'maintenance_upcoming':
      case 'maintenance_overdue':
      case 'maintenance_reminder':
        router.push('/(client)/vehiculos');
        break;
      case 'help_request_accepted':
        router.navigate('/(client)/(tabs)/auxilio');
        break;
      case 'message':
        if (data.businessId) router.push(`/(client)/chat/${data.businessId}`);
        break;
      case 'appointment_scheduled':
      case 'appointment_cancelled':
      case 'appointment_rejected':
        router.push('/(client)/citas');
        break;
      case 'product_intent':
        if (data.productId) router.push(`/(client)/producto/${data.productId}`);
        break;
      case 'service_intent':
        if (data.serviceId) router.push(`/(client)/servicio/${data.serviceId}`);
        break;
    }
    return;
  }

  if (role === 'business') {
    switch (type) {
      case 'help_request':
        router.navigate('/(business)/(tabs)/solicitudes');
        break;
      case 'message':
        if (data.clientId) router.push(`/(business)/chat/${data.clientId}`);
        break;
      case 'appointment_requested':
      case 'appointment_cancelled':
      case 'appointment_reschedule_requested':
      case 'appointment_approved':
        router.push('/(business)/agenda-negocio');
        break;
      case 'kyc_review':
        router.push('/(business)/verificacion');
        break;
    }
  }
}

export function usePushNotifications(userId: string | undefined, role?: Role) {
  useEffect(() => {
    // Expo Go (SDK 53+) no soporta push remoto; solo funciona en un dev client o build standalone.
    if (!userId || Platform.OS === 'web' || Constants.appOwnership === 'expo') return;

    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const tokenResponse = await Notifications.getExpoPushTokenAsync();
      await updatePushToken(userId, tokenResponse.data);
    })().catch((err) => console.error('push token registration error', err));

    if (!role) return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      routeNotification(data, role);
    });

    return () => subscription.remove();
  }, [userId, role]);
}
