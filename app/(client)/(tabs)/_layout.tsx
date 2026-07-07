import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../../constants/colors';
import { useActiveHelpRequestContext } from '../../../hooks/ActiveHelpRequestContext';
import { useAuth } from '../../../hooks/useAuth';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';

// Solo las 5 pestañas reales viven en este navegador de Tabs -- las demás
// pantallas ("servicio", "chat", "configuracion", etc.) se registran como
// Stack.Screen en app/(client)/_layout.tsx para que el botón/gesto de
// "atrás" funcione como una pila real en vez de saltar siempre a Inicio
// (limitación de los navegadores de pestañas, que no llevan un historial
// LIFO). El costo: la tab bar ya no se ve sobre esas pantallas secundarias.
export default function ClientTabsLayout() {
  const { profile } = useAuth();
  const { activeRequest } = useActiveHelpRequestContext();
  const hasUnreadMessages = useUnreadMessages(profile);
  const insets = useSafeAreaInsets();

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
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarHideOnKeyboard: true,
          sceneContainerStyle: {
            backgroundColor: colors.background,
            paddingTop: insets.top,
          },
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
      </Tabs>
    </View>
  );
}
