import { useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';

// Bienvenida a la version piloto -- se muestra una sola vez por cuenta (no
// por dispositivo, para que el account switcher no la repita ni se la salte
// entre cuentas). Vive en el _layout raiz asi que aparece sin importar en
// que pantalla/rol entre el usuario. La duracion del piloto (30 dias) es
// solo informativa aqui -- a proposito NO hay logica de auto-ocultarlo
// cuando se cumplan, eso se quita a mano cuando se pida.
const SEEN_KEY_PREFIX = 'pilot-welcome-seen-';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_SIZE = SCREEN_WIDTH - 32;

export function PilotWelcomeModal() {
  const { profile } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    AsyncStorage.getItem(SEEN_KEY_PREFIX + profile.id).then((seen) => {
      if (!cancelled && !seen) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profile]);

  function dismiss() {
    setVisible(false);
    if (profile) {
      AsyncStorage.setItem(SEEN_KEY_PREFIX + profile.id, '1').catch(() => {});
    }
  }

  if (!profile) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Pressable style={styles.closeBtn} onPress={dismiss} hitSlop={12}>
            <Ionicons name="close" size={22} color="#fff" />
          </Pressable>
          <Ionicons name="rocket-outline" size={40} color={colors.primary} />
          <Text style={styles.title}>¡Bienvenido a SOSmoto!</Text>
          <Text style={styles.subtitle}>Estás usando la versión piloto</Text>
          <Text style={styles.body}>
            Este piloto dura 30 días. Gracias por ser parte de este lanzamiento -- tu opinión nos ayuda a mejorar
            la app para motociclistas y talleres en Ecuador.
          </Text>
          <Pressable style={styles.button} onPress={dismiss}>
            <Text style={styles.buttonText}>Entendido</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    backgroundColor: colors.secondary,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  title: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  body: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
    color: '#D8D8E0',
    textAlign: 'center',
  },
  button: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
