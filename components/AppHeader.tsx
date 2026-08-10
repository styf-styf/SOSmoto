import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackHeaderProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';

// Header compacto (44px de barra + safe area) que reemplaza el nativo de
// NativeStack, cuya altura no es configurable directamente desde JS.
export function AppHeader({ options, back }: NativeStackHeaderProps) {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // FIX: el prop `back` de React Navigation solo dice si hay una pantalla
  // antes DENTRO DEL STACK ANIDADO local (producto/servicio) -- no si hay
  // algo antes en toda la navegación. Como producto/servicio vive dentro de
  // las tabs, la primera vez que se entra ahí desde Inicio/Buscar/Catálogo
  // `back` sale false aunque sí hay de dónde volver, y el replace de abajo
  // terminaba saltando siempre al tab Inicio sin importar de qué pestaña
  // venía el usuario. `router.canGoBack()` sí mira toda la pila (mismo
  // patrón ya usado en components/StoryViewer.tsx) -- el replace a la raíz
  // del rol queda solo para el caso real de deep link (compartir
  // publicación/anuncio/producto/servicio, ver utils/deepLinkNavigate.ts),
  // donde de verdad no hay nada debajo en la pila.
  function handleBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (!session || !profile) {
      router.replace('/(auth)/login');
      return;
    }
    router.replace(profile.role === 'business' ? '/(business)' : '/(client)');
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {options.title ?? ''}
        </Text>
        <View style={styles.side}>
          {options.headerRight?.({ canGoBack: !!back })}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: {
      backgroundColor: colors.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    bar: {
      height: 38,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 4,
    },
    backButton: {
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
    },
    side: {
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      textAlign: 'center',
    },
  });
}
