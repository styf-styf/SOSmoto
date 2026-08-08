import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { TextField } from '../components/TextField';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { submitPilotFeedback } from '../services/pilotFeedback';

// Formulario de "Enviar sugerencia" (Configuración > General, cliente y
// negocio) -- solo para el piloto, se lee desde el admin en /piloto junto
// con el resto de métricas del lanzamiento (ver migración 0198). Pantalla
// única a nivel raíz (mismo patrón que eliminar-cuenta.tsx) porque es
// idéntica para los dos roles, no hace falta duplicarla.
export default function EnviarSugerenciaScreen() {
  const { profile } = useAuth();
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!profile || submitting || !message.trim()) return;
    setSubmitting(true);
    try {
      await submitPilotFeedback(profile.id, message);
      Alert.alert('¡Gracias!', 'Tu sugerencia fue enviada.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (err) {
      console.error('submit pilot feedback error', err);
      Alert.alert('Error', 'No se pudo enviar tu sugerencia. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.infoCard}>
        <Ionicons name="bulb-outline" size={22} color={colors.primary} />
        <Text style={styles.infoText}>
          Estamos en piloto -- cuéntanos qué mejorarías, qué te confundió, o qué te gustaría que la app tuviera.
        </Text>
      </View>

      <TextField
        label="Tu sugerencia"
        placeholder="Escribe aquí..."
        value={message}
        onChangeText={setMessage}
        numberOfLines={6}
      />

      <Button
        title="Enviar sugerencia"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!message.trim()}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
    backgroundColor: colors.background,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
  },
  submitButton: {
    marginTop: 20,
  },
});
