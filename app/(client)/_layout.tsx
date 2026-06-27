import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { ActiveHelpRequestProvider, useActiveHelpRequestContext } from '../../hooks/ActiveHelpRequestContext';
import { useAuth } from '../../hooks/useAuth';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';

export default function ClientLayout() {
  const { profile } = useAuth();
  usePushNotifications(profile?.id);

  return (
    <ActiveHelpRequestProvider clientId={profile?.id}>
      <ClientTabs />
    </ActiveHelpRequestProvider>
  );
}

function ClientTabs() {
  const { profile } = useAuth();
  const { activeRequest } = useActiveHelpRequestContext();
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
        name="buscar"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="auxilio"
        options={{
          title: 'SOS',
          tabBarIcon: ({ size }) => (
            <View>
              <Ionicons name="alert-circle" size={size + 6} color={colors.sos} />
              {activeRequest && (
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
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />

      {/* Pantallas alcanzables por navegación pero sin botón propio en la tab bar,
          para que la tab bar siga visible al entrar a ellas. */}
      <Tabs.Screen name="business/[id]" options={{ href: null, headerShown: true, title: 'Negocio' }} />
      <Tabs.Screen name="historia/[businessId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="historias" options={{ href: null, headerShown: true, title: 'Mis historias' }} />
      <Tabs.Screen name="historia-cliente/[clientId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="publicaciones" options={{ href: null, headerShown: true, title: 'Mis publicaciones' }} />
      <Tabs.Screen name="publicacion/[id]" options={{ href: null, headerShown: true, title: 'Publicación' }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null, headerShown: true, title: 'Chat' }} />
      <Tabs.Screen name="vehiculos" options={{ href: null, headerShown: true, title: 'Mis motos' }} />
      <Tabs.Screen name="historial" options={{ href: null, headerShown: true, title: 'Historial de servicios' }} />
      <Tabs.Screen name="servicio/[id]" options={{ href: null, headerShown: true, title: 'Servicio' }} />
      <Tabs.Screen name="producto/[id]" options={{ href: null, headerShown: true, title: 'Producto' }} />
      <Tabs.Screen name="configuracion" options={{ href: null, headerShown: true, title: 'Configuración' }} />
      <Tabs.Screen name="agendar" options={{ href: null, headerShown: true, title: 'Agendar cita' }} />
      <Tabs.Screen name="citas" options={{ href: null, headerShown: true, title: 'Mis citas' }} />
    </Tabs>
  );
}
