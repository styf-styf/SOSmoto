import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

export default function BusinessLayout() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id);
  const hasUnreadMessages = useUnreadMessages(profile);

  return (
    <Tabs
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

      {/* Pantallas alcanzables por navegación pero sin botón propio en la tab bar,
          para que la tab bar siga visible al entrar a ellas. */}
      <Tabs.Screen name="chat/[id]" options={{ href: null, headerShown: true, title: 'Chat' }} />
      <Tabs.Screen name="empleados" options={{ href: null, headerShown: true, title: 'Equipo' }} />
      <Tabs.Screen name="suscripcion" options={{ href: null, headerShown: true, title: 'Plan y suscripción' }} />
      <Tabs.Screen name="agenda-negocio" options={{ href: null, headerShown: true, title: 'Agenda' }} />
      <Tabs.Screen name="publicidad" options={{ href: null, headerShown: true, title: 'Publicidad' }} />
      <Tabs.Screen name="historias" options={{ href: null, headerShown: true, title: 'Historias' }} />
    </Tabs>
  );
}
