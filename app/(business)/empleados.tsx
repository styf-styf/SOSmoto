import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getPlanLimits, type PlanLimits } from '../../services/catalog';
import {
  addEmployeeByEmail,
  getEmployees,
  removeEmployee,
  updateEmployeePermission,
  type EmployeeWithUser,
} from '../../services/employees';

export default function EmpleadosScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [employees, setEmployees] = useState<EmployeeWithUser[]>([]);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setBusinessId(work.business.id);
    setIsOwner(work.isOwner);

    const [employeeList, planLimits] = await Promise.all([
      getEmployees(work.business.id),
      getPlanLimits(work.business.id),
    ]);
    setEmployees(employeeList);
    setLimits(planLimits);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load empleados error', err))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!businessId) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>Primero crea o únete a un negocio.</Text>
      </View>
    );
  }

  const allowedAdditional = limits?.maxEmployees !== null ? (limits?.maxEmployees ?? 0) - 1 : null;
  const atLimit = allowedAdditional !== null && employees.length >= allowedAdditional;

  function handleAddPress() {
    if (atLimit) {
      Alert.alert(
        'Límite de plan alcanzado',
        `Tu plan ${limits?.planName} permite hasta ${limits?.maxEmployees} personas en el negocio (incluyéndote a ti). Sube de plan para agregar más.`
      );
      return;
    }
    setShowForm(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Equipo</Text>
      <Text style={styles.helperText}>
        {allowedAdditional !== null
          ? `${employees.length}/${allowedAdditional} mecánicos adicionales (plan ${limits?.planName})`
          : `${employees.length} mecánicos en el equipo (plan ${limits?.planName}, sin límite)`}
      </Text>

      {employees.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no agregas mecánicos.</Text>
      ) : (
        employees.map((employee) => (
          <EmployeeRow
            key={employee.id}
            employee={employee}
            isOwner={isOwner}
            onUpdated={(updated) =>
              setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
            }
            onRemoved={() => setEmployees((prev) => prev.filter((e) => e.id !== employee.id))}
          />
        ))
      )}

      {isOwner &&
        (showForm ? (
          <AddEmployeeForm
            businessId={businessId}
            onCancel={() => setShowForm(false)}
            onAdded={(employee) => {
              setEmployees((prev) => [employee, ...prev]);
              setShowForm(false);
            }}
          />
        ) : (
          <Button title="+ Agregar mecánico" variant="secondary" onPress={handleAddPress} style={styles.addButton} />
        ))}

      {!isOwner && (
        <Text style={styles.helperText}>Solo el dueño del negocio puede agregar o quitar mecánicos.</Text>
      )}
    </ScrollView>
  );
}

function EmployeeRow({
  employee,
  isOwner,
  onUpdated,
  onRemoved,
}: {
  employee: EmployeeWithUser;
  isOwner: boolean;
  onUpdated: (employee: EmployeeWithUser) => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleToggle(value: boolean) {
    setBusy(true);
    try {
      await updateEmployeePermission(employee.id, value);
      onUpdated({ ...employee, can_accept_aid_requests: value });
    } catch (err) {
      console.error('update employee permission error', err);
    } finally {
      setBusy(false);
    }
  }

  function handleRemove() {
    Alert.alert('Quitar del equipo', `¿Quitar a ${employee.user?.full_name ?? 'esta persona'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeEmployee(employee.id);
            onRemoved();
          } catch (err) {
            console.error('remove employee error', err);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{employee.user?.full_name ?? 'Usuario'}</Text>
        {isOwner && (
          <Pressable onPress={handleRemove}>
            <Ionicons name="trash-outline" size={20} color={colors.danger} />
          </Pressable>
        )}
      </View>
      {employee.user?.email && <Text style={styles.cardMeta}>{employee.user.email}</Text>}
      {employee.user?.phone && <Text style={styles.cardMeta}>{employee.user.phone}</Text>}

      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>Puede aceptar auxilios</Text>
        <Switch value={employee.can_accept_aid_requests} onValueChange={handleToggle} disabled={busy || !isOwner} />
      </View>
    </View>
  );
}

function AddEmployeeForm({
  businessId,
  onCancel,
  onAdded,
}: {
  businessId: string;
  onCancel: () => void;
  onAdded: (employee: EmployeeWithUser) => void;
}) {
  const [email, setEmail] = useState('');
  const [canAccept, setCanAccept] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!email.trim()) {
      Alert.alert('Falta el correo', 'Ingresa el correo con el que se registró en la app.');
      return;
    }
    setSaving(true);
    try {
      const employee = await addEmployeeByEmail(businessId, email.trim(), canAccept);
      onAdded(employee);
    } catch (err) {
      console.error('add employee error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo agregar al mecánico.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <TextField
        label="Correo del mecánico"
        placeholder="mecanico@correo.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.helperText}>Debe haberse registrado antes en la app.</Text>
      <View style={styles.cardFooter}>
        <Text style={styles.cardMeta}>Puede aceptar auxilios</Text>
        <Switch value={canAccept} onValueChange={setCanAccept} />
      </View>
      <View style={styles.editActions}>
        <Button title="Agregar" onPress={handleAdd} loading={saving} style={styles.flexButton} />
        <Button title="Cancelar" variant="secondary" onPress={onCancel} style={styles.flexButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  container: {
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  flexButton: {
    flex: 1,
  },
  addButton: {
    marginTop: 4,
  },
});
