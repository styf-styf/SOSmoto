import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  rightIcon?: { name: keyof typeof Ionicons.glyphMap; onPress: () => void };
}

export function TextField({ label, error, style, rightIcon, ...inputProps }: TextFieldProps) {
  // Se despliega hacia abajo (como el input del chat) para que un texto mas
  // largo que el ancho del campo siga siendo visible completo, en vez de
  // recortarse. secureTextEntry queda afuera a proposito: React Native no
  // soporta multiline + secureTextEntry juntos (el enmascarado de contraseña
  // se rompe), así que esos campos se quedan de una sola línea.
  const allowMultiline = !inputProps.secureTextEntry;
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[styles.input, error && styles.inputError, rightIcon && styles.inputWithIcon, style]}
          placeholderTextColor={colors.textMuted}
          multiline={allowMultiline}
          blurOnSubmit={!allowMultiline}
          {...inputProps}
        />
        {rightIcon && (
          <Pressable style={styles.iconButton} onPress={rightIcon.onPress}>
            <Ionicons name={rightIcon.name} size={20} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    minHeight: 50,
    maxHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  inputWithIcon: {
    paddingRight: 44,
  },
  iconButton: {
    position: 'absolute',
    right: 4,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputError: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 4,
  },
});
