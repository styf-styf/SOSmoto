import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import { getMyWorkBusiness } from '../../../services/businesses';
import type { BusinessType } from '../../../types/database';

// Solo las 5 pestañas reales viven en este navegador de Tabs -- el resto de
// pantallas se registran como Stack.Screen en app/(business)/_layout.tsx,
// mismo motivo que en (client)/(tabs)/_layout.tsx.
export default function BusinessTabsLayout() {
  const { profile } = useAuth();
  const hasUnreadMessages = useUnreadMessages(profile);
  const insets = useSafeAreaInsets();
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);

  useEffect(() => {
    if (!profile) return;
    getMyWorkBusiness(profile.id)
      .then((work) => setBusinessType(work?.business?.business_type ?? null))
      .catch(() => {});
  }, [profile]);

  const isWorkshop = businessType === 'workshop';

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Franja fija que bloquea el área del status bar mientras se hace scroll */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: colors.background,
          zIndex: 100,
        }}
      />
      <Tabs
        {...({ sceneContainerStyle: { backgroundColor: colors.background, paddingTop: insets.top } } as object)}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarHideOnKeyboard: true,
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="catalogo"
        options={{
          title: 'Catálogo',
          tabBarIcon: ({ color, size }) => <Ionicons name="cube" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="solicitudes"
        options={{
          title: 'Solicitudes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alert-circle" size={size} color={color} />
          ),
          tabBarButton: isWorkshop ? undefined : () => null,
        }}
      />
      <Tabs.Screen
        name="mensajes"
        options={{
          title: 'Mensajes',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="chatbubble-ellipses" size={size} color={color} />
              {hasUnreadMessages && (
                <View
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: colors.sos,
                    borderWidth: 1.5,
                    borderColor: '#fff',
                  }}
                />
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Negocio',
          tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} />,
        }}
      />
      </Tabs>
    </View>
  );
}
