import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from './Button';
import { colors } from '../constants/colors';

// Modal simple para reportar contenido/negocios inapropiados (posts,
// reseñas, negocios) -- reusado desde PostDetail y BusinessProfileView.
export function ReportModal({
  visible,
  targetLabel,
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  targetLabel: string;
  onCancel: () => void;
  onSubmit: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState('');
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    setSending(true);
    try {
      await onSubmit(reason);
      setReason('');
    } finally {
      setSending(false);
    }
  }

  function handleCancel() {
    setReason('');
    onCancel();
  }

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Reportar {targetLabel}</Text>
            <Pressable onPress={handleCancel} hitSlop={8}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <Text style={styles.subtitle}>Cuéntanos qué está mal (opcional). Un admin lo va a revisar.</Text>
          <TextInput
            style={styles.input}
            placeholder="Motivo (opcional)"
            placeholderTextColor={colors.textMuted}
            value={reason}
            onChangeText={setReason}
            multiline
            textAlignVertical="top"
          />
          <View style={styles.actions}>
            <Button title="Cancelar" variant="secondary" onPress={handleCancel} style={styles.flexButton} />
            <Button title="Reportar" onPress={handleSubmit} loading={sending} style={styles.flexButton} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  close: {
    fontSize: 16,
    color: colors.textMuted,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  input: {
    minHeight: 80,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  flexButton: {
    flex: 1,
  },
});
