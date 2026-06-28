import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Link, router } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { signUp } from '../../services/auth';
import type { UserRole } from '../../types/database';
import { translateAuthError } from '../../utils/authErrors';
import { getPasswordStrength, isValidEcuadorPhone, isValidEmail } from '../../utils/validators';

type SelectableRole = Exclude<UserRole, 'admin'>;

interface FormErrors {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

const strengthLabel: Record<string, string> = {
  weak: 'Débil',
  medium: 'Media',
  strong: 'Fuerte',
};

const strengthColor: Record<string, string> = {
  weak: colors.danger,
  medium: colors.warning,
  strong: colors.success,
};

export default function RegisterScreen() {
  const [role, setRole] = useState<SelectableRole>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  function clearError(field: keyof FormErrors) {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!fullName.trim()) next.fullName = 'Ingresa tu nombre completo.';
    if (!email.trim()) next.email = 'Ingresa tu correo.';
    else if (!isValidEmail(email)) next.email = 'Ese correo no tiene un formato válido.';
    if (phone.trim() && !isValidEcuadorPhone(phone)) {
      next.phone = 'Usa un celular ecuatoriano válido (ej. 09xxxxxxxx).';
    }
    if (!password) next.password = 'Ingresa una contraseña.';
    else if (password.length < 6) next.password = 'Usa al menos 6 caracteres.';
    if (confirmPassword !== password) next.confirmPassword = 'Las contraseñas no coinciden.';

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleRegister() {
    if (!validate()) return;

    setLoading(true);
    try {
      await signUp({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        role,
      });
      router.replace('/');
    } catch (err) {
      console.error('register error', err);
      const message = err instanceof Error ? translateAuthError(err.message) : 'No se pudo crear la cuenta.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAwareScrollView contentContainerStyle={styles.container} bottomOffset={32}>
      <Text style={styles.title}>Crear cuenta</Text>

      <View style={styles.roleSelector}>
        <RoleOption
          label="Soy cliente"
          selected={role === 'client'}
          onPress={() => setRole('client')}
          disabled={loading}
        />
        <RoleOption
          label="Soy negocio"
          selected={role === 'business'}
          onPress={() => setRole('business')}
          disabled={loading}
        />
      </View>

      <TextField
        label="Nombre completo"
        placeholder="Tu nombre"
        value={fullName}
        onChangeText={(t) => {
          setFullName(t);
          clearError('fullName');
        }}
        editable={!loading}
        error={errors.fullName}
      />
      <TextField
        label="Correo electrónico"
        placeholder="tucorreo@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          clearError('email');
        }}
        editable={!loading}
        error={errors.email}
      />
      <TextField
        label="Teléfono (opcional)"
        placeholder="09xxxxxxxx"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={(t) => {
          setPhone(t);
          clearError('phone');
        }}
        editable={!loading}
        error={errors.phone}
      />
      <TextField
        label="Contraseña"
        placeholder="********"
        secureTextEntry={!showPassword}
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          clearError('password');
          clearError('confirmPassword');
        }}
        editable={!loading}
        error={errors.password}
        rightIcon={{
          name: showPassword ? 'eye-off-outline' : 'eye-outline',
          onPress: () => setShowPassword((v) => !v),
        }}
      />
      {password.length > 0 && !errors.password && (
        <Text style={[styles.strengthText, { color: strengthColor[passwordStrength] }]}>
          Fuerza de la contraseña: {strengthLabel[passwordStrength]}
        </Text>
      )}
      <TextField
        label="Confirmar contraseña"
        placeholder="********"
        secureTextEntry={!showPassword}
        value={confirmPassword}
        onChangeText={(t) => {
          setConfirmPassword(t);
          clearError('confirmPassword');
        }}
        editable={!loading}
        error={errors.confirmPassword}
      />

      <Button title="Crear cuenta" onPress={handleRegister} loading={loading} style={styles.submitButton} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Inicia sesión
        </Link>
      </View>
    </KeyboardAwareScrollView>
  );
}

function RoleOption({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.roleOption, selected && styles.roleOptionSelected]}
    >
      <Text style={[styles.roleOptionText, selected && styles.roleOptionTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  roleOption: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  roleOptionText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  roleOptionTextSelected: {
    color: colors.primary,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: -10,
    marginBottom: 16,
  },
  submitButton: {
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  footerText: {
    color: colors.textMuted,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
