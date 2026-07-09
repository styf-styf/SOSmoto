import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export function QuantityStepper({ value, onChange, min = 1, max }: QuantityStepperProps) {
  const canDecrement = value > min;
  const canIncrement = max === undefined || value < max;

  return (
    <View style={styles.container}>
      <Pressable
        style={[styles.btn, !canDecrement && styles.btnDisabled]}
        disabled={!canDecrement}
        onPress={() => onChange(value - 1)}
      >
        <Ionicons name="remove" size={18} color={canDecrement ? colors.primary : colors.textMuted} />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        style={[styles.btn, !canIncrement && styles.btnDisabled]}
        disabled={!canIncrement}
        onPress={() => onChange(value + 1)}
      >
        <Ionicons name="add" size={18} color={canIncrement ? colors.primary : colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 4,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  value: {
    minWidth: 28,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
});
