import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Link, router } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { signUp } from '../../services/auth';
import type { UserRole } from '../../types/database';

type SelectableRole = Exclude<UserRole, 'admin'>;

export default function RegisterScreen() {
  const [role, setRole] = useState<SelectableRole>('client');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!fullName || !email || !password) {
      Alert.alert('Faltan datos', 'Completa nombre, correo y contraseña.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Contraseña débil', 'Usa al menos 6 caracteres.');
      return;
    }

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
      const message = err instanceof Error ? err.message : 'No se pudo crear la cuenta.';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Crear cuenta</Text>

      <View style={styles.roleSelector}>
        <RoleOption
          label="Soy cliente"
          selected={role === 'client'}
          onPress={() => setRole('client')}
        />
        <RoleOption
          label="Soy negocio"
          selected={role === 'business'}
          onPress={() => setRole('business')}
        />
      </View>

      <TextField label="Nombre completo" placeholder="Tu nombre" value={fullName} onChangeText={setFullName} />
      <TextField
        label="Correo electrónico"
        placeholder="tucorreo@email.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Teléfono (opcional)"
        placeholder="09xxxxxxxx"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TextField
        label="Contraseña"
        placeholder="********"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Button title="Crear cuenta" onPress={handleRegister} loading={loading} />

      <View style={styles.footer}>
        <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
        <Link href="/(auth)/login" style={styles.link}>
          Inicia sesión
        </Link>
      </View>
    </ScrollView>
  );
}

function RoleOption({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
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
