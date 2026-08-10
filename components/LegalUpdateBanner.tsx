import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../hooks/ThemeContext';
import type { ColorTheme } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { acknowledgeLegalUpdate, getLatestLegalPublishedAt } from '../services/legal';

// Aviso no bloqueante de cambios en Términos/Privacidad (ver Configuración >
// admin): si el usuario sigue usando la app sin tocar "Entendido", igual se
// considera que los aceptó -- por eso no bloquea nada, solo informa. Se
// muestra en el Home de cliente y negocio.
export function LegalUpdateBanner() {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { profile, refreshProfile } = useAuth();
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    getLatestLegalPublishedAt().then(setPublishedAt).catch(() => {});
  }, []);

  if (!profile || !publishedAt || dismissed) return null;
  const ackAt = profile.legal_ack_at;
  if (ackAt && new Date(ackAt) >= new Date(publishedAt)) return null;

  async function handleAccept() {
    setDismissed(true);
    if (profile) {
      await acknowledgeLegalUpdate(profile.id).catch(() => {});
      refreshProfile();
    }
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>
        Actualizamos nuestros{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://sosmoto.net/terminos')}>
          Términos y Condiciones
        </Text>{' '}
        y la{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://sosmoto.net/privacidad')}>
          Política de Privacidad
        </Text>
        . Si continúas usando la app, consideramos que los aceptas.
      </Text>
      <Pressable onPress={handleAccept} style={styles.button}>
        <Text style={styles.buttonText}>Entendido</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    banner: {
      backgroundColor: colors.warningLight,
      borderWidth: 1,
      borderColor: colors.warning,
      borderRadius: 12,
      padding: 12,
      marginHorizontal: 16,
      marginBottom: 12,
    },
    text: {
      fontSize: 12.5,
      color: '#7A5B00',
      lineHeight: 17,
      marginBottom: 8,
    },
    link: {
      fontWeight: '700',
      textDecorationLine: 'underline',
    },
    button: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    buttonText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
