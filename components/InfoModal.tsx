import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { colors } from '../constants/colors';

// Botón ⓘ reutilizable -- abre un InfoModal con la guía de una pantalla
// compleja (mismo patrón que catalogo.tsx introdujo para stock/variantes).
export function InfoButton({
  onPress,
  accessibilityLabel,
  size = 24,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}) {
  return (
    <Pressable style={styles.infoBtn} onPress={onPress} hitSlop={8} accessibilityLabel={accessibilityLabel}>
      <Ionicons name="information-circle-outline" size={size} color={colors.primary} />
    </Pressable>
  );
}

export function InfoModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {children}
        <Button title="Entendido" onPress={onClose} style={styles.closeButton} />
      </ScrollView>
    </Modal>
  );
}

export function InfoStep({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>{number}</Text>
        </View>
        <Text style={styles.stepTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

export function InfoExample({ label, ok, children }: { label: string; ok?: boolean; children: ReactNode }) {
  return (
    <View style={[styles.exampleBox, ok === false && styles.exampleBoxError]}>
      <Text style={[styles.exampleLabel, ok === false && styles.exampleLabelError]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  infoBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  closeButton: {
    marginTop: 8,
  },
  step: {
    marginBottom: 26,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  stepTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  exampleBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.success,
  },
  exampleBoxError: {
    borderLeftColor: colors.danger,
  },
  exampleLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  exampleLabelError: {
    color: colors.danger,
  },
});

export const infoTextStyles = StyleSheet.create({
  text: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 19,
    marginBottom: 10,
  },
  bold: {
    fontWeight: '700',
  },
  exampleText: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18,
  },
  exampleTextMuted: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 4,
  },
});
