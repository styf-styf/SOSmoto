import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../../constants/colors';
import { useAuth } from '../../../hooks/useAuth';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import { getMyWorkBusiness } from '../../../services/businesses';
import type { BusinessType } from '../../../types/database';

interface CachedBusinessTabMeta {
  businessType: BusinessType | null;
  logoUrl: string | null;
}

function businessTabMetaCacheKey(userId: string) {
  return `business-tab-meta-${userId}`;
}

// Solo las pestañas reales viven en este navegador de Tabs -- el resto de
// pantallas se registran como Stack.Screen en app/(business)/_layout.tsx,
// mismo motivo que en (client)/(tabs)/_layout.tsx. "solicitudes" es exclusiva
// de taller (workshop) según business_type; usar href: null en vez de
// tabBarButton para que la pestaña oculta no deje hueco. "pedidos" ya es
// visible para ambos tipos (product_intents dejó de ser exclusivo de
// tienda) -- para taller ocupa el lugar de "catalogo" en la barra (que
// sigue disponible desde Configuración).
// "producto" y "servicio" viven acá con href: null a propósito (para que la
// tab bar siga visible al entrar a un producto/servicio). Cada carpeta tiene
// su propio _layout.tsx con un Stack anidado, así cada item visitado se
// apila (A -> B -> C, con header y botón de atrás real) sin perder la tab
// bar de encima. Al tocar "Inicio" en la tab bar, index.tsx llama
// resetProductoServicioStacks() (ver utils/productoServicioStackReset.ts),
// que remonta esos dos Stacks anidados con la pila vacía.
export default function BusinessTabsLayout() {
  const { profile } = useAuth();
  const hasUnreadMessages = useUnreadMessages(profile);
  const insets = useSafeAreaInsets();
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [businessLogoUrl, setBusinessLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    // Sin esto, cada apertura fría de la app mostraba la pestaña
    // "Solicitudes" (taller) y el logo real del negocio con un instante de
    // retraso -- mientras getMyWorkBusiness viaja por red, businessType y
    // businessLogoUrl siguen en null, así que la tab bar nace "asumiendo no
    // taller" (ver el condicional de href de "catalogo"/"solicitudes" abajo)
    // y el ícono de Perfil nace genérico, hasta que la respuesta llega y
    // ambos "saltan" a su valor real. AsyncStorage resuelve en unos ms (vs.
    // el round-trip de red), así que pintar primero el último valor conocido
    // elimina el salto en la práctica para cualquier apertura que no sea la
    // primera vez que este usuario entra como negocio en este dispositivo.
    const fetchedRealValueRef = { current: false };
    AsyncStorage.getItem(businessTabMetaCacheKey(profile.id))
      .then((raw) => {
        if (cancelled || fetchedRealValueRef.current || !raw) return;
        const cached = JSON.parse(raw) as CachedBusinessTabMeta;
        setBusinessType(cached.businessType);
        setBusinessLogoUrl(cached.logoUrl);
      })
      .catch(() => {});

    getMyWorkBusiness(profile.id)
      .then((work) => {
        if (cancelled) return;
        fetchedRealValueRef.current = true;
        const meta: CachedBusinessTabMeta = {
          businessType: work?.business?.business_type ?? null,
          logoUrl: work?.business?.logo_url ?? null,
        };
        setBusinessType(meta.businessType);
        setBusinessLogoUrl(meta.logoUrl);
        AsyncStorage.setItem(businessTabMetaCacheKey(profile.id), JSON.stringify(meta)).catch(() => {});
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
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
          lazy: false,
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
          // Mientras businessType todavia no resuelve (null), ocultar esta
          // pestaña en vez de asumir "no es taller" -- si no, en talleres se
          // alcanza a ver "Catálogo" un instante antes de que aparezca
          // "Solicitudes" y desaparezca esta, un flash confuso en la tab bar.
          href: businessType === null || isWorkshop ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="pedidos"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="solicitudes"
        options={{
          title: 'Solicitudes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="alert-circle" size={size} color={color} />
          ),
          href: isWorkshop ? undefined : null,
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
          tabBarIcon: ({ color, size }) =>
            businessLogoUrl ? (
              <Image source={{ uri: businessLogoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />
            ) : (
              <Ionicons name="person-circle" size={size} color={color} />
            ),
        }}
      />
      <Tabs.Screen name="producto" options={{ href: null }} />
      <Tabs.Screen name="servicio" options={{ href: null }} />
      </Tabs>
    </View>
  );
}
