import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getMyWorkBusiness } from '../../services/businesses';
import { getPlanLimits, type PlanLimits } from '../../services/catalog';
import {
  addEmployeeByEmail,
  getEmployees,
  removeEmployee,
  updateEmployeeJobTitle,
  updateEmployeePermissions,
  type EmployeePermissions,
  type EmployeeWithUser,
} from '../../services/employees';
import {
  cancelInvitation,
  getPendingInvitationsForBusiness,
  type EmployeeInvitationWithInvitee,
} from '../../services/employeeInvitations';
import type { BusinessType } from '../../types/database';

const PERMISSION_ROWS: { key: keyof EmployeePermissions; field: keyof EmployeeWithUser; label: string }[] = [
  { key: 'canAcceptAidRequests', field: 'can_accept_aid_requests', label: 'Puede aceptar auxilios' },
  { key: 'canManageCatalog', field: 'can_manage_catalog', label: 'Puede editar catálogo (productos/servicios)' },
  { key: 'canReplyChat', field: 'can_reply_chat', label: 'Puede responder chats' },
  { key: 'canUploadStories', field: 'can_upload_stories', label: 'Puede subir historias' },
  { key: 'canCreatePosts', field: 'can_create_posts', label: 'Puede crear publicaciones' },
];

function getJobTitlePlaceholder(businessType: BusinessType | null): string {
  if (businessType === 'workshop') return 'Ej. Mecánico, Secretaria, Administrador';
  if (businessType === 'store') return 'Ej. Recepcionista, Bodega, Administrador';
  return 'Ej. Administrador';
}

interface EmpleadosData {
  businessId: string | null;
  businessType: BusinessType | null;
  isOwner: boolean;
  isLimited: boolean;
  employees: EmployeeWithUser[];
  invitations: EmployeeInvitationWithInvitee[];
  limits: PlanLimits | null;
}

export default function EmpleadosScreen() {
  const { profile } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `empleados-${profile.id}` : null;
  const { data, loading, reload, setData } = useCachedLoad<EmpleadosData>(cacheKey, async () => {
    const empty: EmpleadosData = { businessId: null, businessType: null, isOwner: false, isLimited: false, employees: [], invitations: [], limits: null };
    if (!profile) return empty;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return empty;
    const [employeeList, planLimits, pendingInvitations] = await Promise.all([
      getEmployees(work.business.id),
      getPlanLimits(work.business.id),
      getPendingInvitationsForBusiness(work.business.id),
    ]);
    return {
      businessId: work.business.id,
      businessType: work.business.business_type,
      isOwner: work.isOwner,
      isLimited: work.business.is_limited,
      employees: employeeList,
      invitations: pendingInvitations,
      limits: planLimits,
    };
  });
  const businessId = data?.businessId ?? null;
  const businessType = data?.businessType ?? null;
  const isOwner = data?.isOwner ?? false;
  const isLimited = data?.isLimited ?? false;
  const employees = data?.employees ?? [];
  const invitations = data?.invitations ?? [];
  const limits = data?.limits ?? null;

  function setEmployees(updater: (prev: EmployeeWithUser[]) => EmployeeWithUser[]) {
    setData((prev) => (prev ? { ...prev, employees: updater(prev.employees) } : prev));
  }

  function setInvitations(updater: (prev: EmployeeInvitationWithInvitee[]) => EmployeeInvitationWithInvitee[]) {
    setData((prev) => (prev ? { ...prev, invitations: updater(prev.invitations) } : prev));
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('load empleados error', err);
    } finally {
      setRefreshing(false);
    }
  }

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

  const allowedAdditional = limits?.maxEmployees ?? null;
  const atLimit = allowedAdditional !== null && employees.length >= allowedAdditional;

  function handleAddPress() {
    if (atLimit) {
      Alert.alert(
        'Límite de plan alcanzado',
        `Tu plan ${limits?.planName} permite hasta ${limits?.maxEmployees} personas adicionales en el equipo (sin contar al dueño). Sube de plan para agregar más.`
      );
      return;
    }
    setShowForm(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[colors.primary]} />}>
      <Text style={styles.helperText}>
        {allowedAdditional !== null
          ? `${employees.length}/${allowedAdditional} personas adicionales en el equipo (plan ${limits?.planName})`
          : `${employees.length} personas en el equipo (plan ${limits?.planName}, sin límite)`}
      </Text>

      {isOwner && isLimited && (
        <Text style={styles.limitedNotice}>
          Tu negocio está limitado: no puedes agregar, quitar ni editar permisos del equipo.
        </Text>
      )}

      {/* Invitaciones pendientes */}
      {invitations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invitaciones pendientes</Text>
          {invitations.map((inv) => (
            <InvitationRow
              key={inv.id}
              invitation={inv}
              isOwner={isOwner && !isLimited}
              onCancelled={() => setInvitations((prev) => prev.filter((i) => i.id !== inv.id))}
            />
          ))}
        </View>
      )}

      {/* Personal activo */}
      {employees.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no agregas personal.</Text>
      ) : (
        employees.map((employee) => (
          <EmployeeRow
            key={employee.id}
            employee={employee}
            businessType={businessType}
            isOwner={isOwner && !isLimited}
            onUpdated={(updated) =>
              setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
            }
            onRemoved={() => setEmployees((prev) => prev.filter((e) => e.id !== employee.id))}
          />
        ))
      )}

      {isOwner &&
        !isLimited &&
        (showForm ? (
          <AddEmployeeForm
            businessId={businessId}
            businessType={businessType}
            onCancel={() => setShowForm(false)}
            onInvited={() => {
              setShowForm(false);
              reload().catch((err) => console.error('reload empleados error', err));
            }}
          />
        ) : (
          <Button title="+ Agregar personal" variant="secondary" onPress={handleAddPress} style={styles.addButton} />
        ))}

      {!isOwner && (
        <Text style={styles.helperText}>Solo el dueño del negocio puede agregar o quitar personal.</Text>
      )}
    </ScrollView>
  );
}

function InvitationRow({
  invitation,
  isOwner,
  onCancelled,
}: {
  invitation: EmployeeInvitationWithInvitee;
  isOwner: boolean;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);

  function handleCancel() {
    Alert.alert('Cancelar invitación', `¿Cancelar la invitación enviada a ${invitation.invitee_name}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancelar invitación',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await cancelInvitation(invitation.id);
            onCancelled();
          } catch (err) {
            console.error('cancel invitation error', err);
            Alert.alert('Error', 'No se pudo cancelar la invitación.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.card, styles.invitationCard]}>
      <View style={styles.cardHeader}>
        <View style={styles.invitationInfo}>
          <Ionicons name="time-outline" size={16} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{invitation.invitee_name}</Text>
            <Text style={styles.cardMeta}>{invitation.invitee_email}</Text>
            {invitation.job_title && <Text style={styles.cardMeta}>Cargo: {invitation.job_title}</Text>}
          </View>
        </View>
        {isOwner && (
          <Pressable onPress={handleCancel} disabled={busy}>
            {busy ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Ionicons name="close-circle-outline" size={20} color={colors.danger} />
            )}
          </Pressable>
        )}
      </View>
      <Text style={styles.invitationStatus}>Esperando respuesta…</Text>
    </View>
  );
}

function EmployeeRow({
  employee,
  businessType,
  isOwner,
  onUpdated,
  onRemoved,
}: {
  employee: EmployeeWithUser;
  businessType: BusinessType | null;
  isOwner: boolean;
  onUpdated: (employee: EmployeeWithUser) => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [jobTitle, setJobTitle] = useState(employee.job_title ?? '');
  const [savingJobTitle, setSavingJobTitle] = useState(false);
  const activePermissions = PERMISSION_ROWS.filter((row) => Boolean(employee[row.field]));

  async function handleToggle(key: keyof EmployeePermissions, field: keyof EmployeeWithUser, value: boolean) {
    setBusy(true);
    try {
      await updateEmployeePermissions(employee.id, { [key]: value });
      onUpdated({ ...employee, [field]: value });
    } catch (err) {
      console.error('update employee permission error', err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveJobTitle() {
    setSavingJobTitle(true);
    try {
      const trimmed = jobTitle.trim() || null;
      await updateEmployeeJobTitle(employee.id, trimmed);
      onUpdated({ ...employee, job_title: trimmed });
      setEditing(false);
    } catch (err) {
      console.error('update employee job title error', err);
      Alert.alert('Error', 'No se pudo guardar el cargo.');
    } finally {
      setSavingJobTitle(false);
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
        <Text style={styles.cardTitle}>
          {employee.user?.full_name ?? 'Usuario'} | {employee.job_title || 'Sin cargo asignado'}
        </Text>
        {isOwner && (
          <View style={styles.cardHeaderActions}>
            <Pressable
              style={styles.iconButtonBox}
              onPress={() => { setJobTitle(employee.job_title ?? ''); setEditing((v) => !v); }}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} />
            </Pressable>
            <Pressable style={[styles.iconButtonBox, styles.iconButtonBoxDanger]} onPress={handleRemove}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
            </Pressable>
          </View>
        )}
      </View>
      {employee.user?.email && <Text style={styles.cardMeta}>{employee.user.email}</Text>}
      {employee.user?.phone && <Text style={styles.cardMeta}>{employee.user.phone}</Text>}

      {!editing ? (
        // Solo informativo -- muestra lo que la persona SÍ tiene autorizado,
        // no todos los permisos con su switch. Para cambiar algo hay que
        // entrar a editar.
        <View style={styles.permissionsList}>
          {activePermissions.length === 0 ? (
            <Text style={styles.noPermissionsText}>Sin privilegios activos.</Text>
          ) : (
            activePermissions.map((row) => (
              <View key={row.key} style={styles.permissionRow}>
                <Ionicons name="checkmark-circle" size={15} color={colors.primary} />
                <Text style={styles.permissionText}>{row.label}</Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={styles.jobTitleEditBox}>
          <TextField label="Cargo" placeholder={getJobTitlePlaceholder(businessType)} value={jobTitle} onChangeText={setJobTitle} />

          {PERMISSION_ROWS.map((row) => (
            <View key={row.key} style={styles.cardFooter}>
              <Text style={styles.cardMeta}>{row.label}</Text>
              <Switch
                value={Boolean(employee[row.field])}
                onValueChange={(value) => handleToggle(row.key, row.field, value)}
                disabled={busy || !isOwner}
              />
            </View>
          ))}

          <View style={styles.editActions}>
            <Button title="Guardar" onPress={handleSaveJobTitle} loading={savingJobTitle} style={styles.flexButton} />
            <Button title="Cancelar" variant="secondary" onPress={() => setEditing(false)} style={styles.flexButton} />
          </View>
        </View>
      )}
    </View>
  );
}

function AddEmployeeForm({
  businessId,
  businessType,
  onCancel,
  onInvited,
}: {
  businessId: string;
  businessType: BusinessType | null;
  onCancel: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [permissions, setPermissions] = useState<EmployeePermissions>({
    canAcceptAidRequests: true,
    canManageCatalog: true,
    canReplyChat: true,
    canUploadStories: false,
    canCreatePosts: false,
  });
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!email.trim()) {
      Alert.alert('Falta el correo', 'Ingresa el correo con el que se registró en la app.');
      return;
    }
    if (!jobTitle.trim()) {
      Alert.alert('Falta el cargo', 'Ingresa el cargo de esta persona en el negocio (ej. Mecánico, Secretaria, Bodega).');
      return;
    }
    setSaving(true);
    try {
      await addEmployeeByEmail(businessId, email.trim(), jobTitle.trim(), permissions);
      Alert.alert('Invitación enviada', 'Recibirá una notificación para aceptar o rechazar la invitación.');
      onInvited();
    } catch (err) {
      console.error('add employee error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar la invitación.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <TextField
        label="Correo del nuevo integrante"
        placeholder="correo@ejemplo.com"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.helperText}>Debe haberse registrado antes en la app.</Text>

      <TextField label="Cargo *" placeholder={getJobTitlePlaceholder(businessType)} value={jobTitle} onChangeText={setJobTitle} />

      {PERMISSION_ROWS.map((row) => (
        <View key={row.key} style={styles.cardFooter}>
          <Text style={styles.cardMeta}>{row.label}</Text>
          <Switch
            value={permissions[row.key]}
            onValueChange={(value) => setPermissions((prev) => ({ ...prev, [row.key]: value }))}
          />
        </View>
      ))}
      <View style={styles.editActions}>
        <Button title="Enviar invitación" onPress={handleAdd} loading={saving} style={styles.flexButton} />
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
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  section: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  limitedNotice: {
    fontSize: 13,
    color: colors.danger,
    backgroundColor: '#FBE8E8',
    borderRadius: 8,
    padding: 10,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  invitationCard: {
    borderWidth: 1,
    borderColor: colors.warning + '40',
    backgroundColor: colors.warning + '10',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButtonBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonBoxDanger: {
    backgroundColor: '#FBE8E8',
  },
  invitationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
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
  invitationStatus: {
    fontSize: 12,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 6,
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
  permissionsList: {
    marginTop: 10,
    gap: 6,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  permissionText: {
    fontSize: 13,
    color: colors.text,
  },
  noPermissionsText: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  jobTitleEditBox: {
    marginTop: 8,
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
