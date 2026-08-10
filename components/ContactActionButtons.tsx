import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { toWhatsappLink } from '../utils/whatsapp';

// Botones "Llamar"/"WhatsApp" repetidos carácter por carácter en
// cliente/[id].tsx y cliente-externo.tsx (lado negocio). Renderiza solo los
// Pressable -- el caller sigue poniendo su propio View con actionsRow
// alrededor, junto a los demás botones que sí difieren por pantalla (chat,
// crear informe, invitar a la app).
export function ContactActionButtons({ phone }: { phone: string }) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <>
      <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${phone}`)}>
        <Ionicons name="call-outline" size={20} color={colors.primary} />
        <Text style={styles.actionLabel}>Llamar</Text>
      </Pressable>
      <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(toWhatsappLink(phone))}>
        <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
        <Text style={styles.actionLabel}>WhatsApp</Text>
      </Pressable>
    </>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    actionBtn: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      gap: 4,
    },
    actionLabel: {
      fontSize: 12,
      color: colors.text,
      fontWeight: '600',
    },
  });
}
