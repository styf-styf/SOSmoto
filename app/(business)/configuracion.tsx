import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { useSavedAccountToggle } from '../../hooks/useSavedAccountToggle';
import { signOut } from '../../services/auth';
import { getMyWorkBusiness, setBusinessDeactivated } from '../../services/businesses';

// Ver app/(client)/configuracion.tsx -- mismo motivo: diagnosticar si el
// dispositivo ya aplicó la última actualización OTA o sigue en la anterior.
const buildInfo = Updates.isEmbeddedLaunch
  ? 'Build de fábrica (sin actualización OTA aplicada)'
  : `Update ${Updates.updateId?.slice(0, 8) ?? '?'} · ${Updates.createdAt?.toLocaleString('es-EC') ?? ''}`;
const appVersion = Constants.expoConfig?.version ?? '?';
import { ADS_ENABLED } from '../../constants/features';
import { getPlanLimits, type PlanLimits } from '../../services/catalog';
import { getEmployees, type EmployeeWithUser } from '../../services/employees';
import type { Business } from '../../types/database';

const planLabel: Record<string, string> = {
  free: 'Free',
  standard: 'Estándar',
  pro: 'Pro',
};

interface BusinessConfigData {
  business: Business | null;
  plan: PlanLimits | null;
  employeeCount: number;
  isOwner: boolean;
  // Fila propia dentro de business_employees -- null si es el dueño (nunca
  // tiene fila ahí, su acceso es total) o si por algún motivo no aparece en
  // la lista todavía.
  myPermissions: EmployeeWithUser | null;
}

export default function BusinessConfiguracionScreen() {
  const { profile } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const quickAccess = useSavedAccountToggle(profile?.id);

  const [togglingDeactivated, setTogglingDeactivated] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const cacheKey = profile ? `business-config-${profile.id}` : null;
  const { data, loading, reload, setData } = useCachedLoad<BusinessConfigData>(
    cacheKey,
    async () => {
      if (!profile)
        return {
          business: null,
          plan: null,
          employeeCount: 0,
          isOwner: false,
          myPermissions: null,
        };
      const work = await getMyWorkBusiness(profile.id);
      const myBusiness = work?.business ?? null;
      if (!myBusiness)
        return {
          business: null,
          plan: null,
          employeeCount: 0,
          isOwner: false,
          myPermissions: null,
        };
      const [planLimits, employees] = await Promise.all([
        getPlanLimits(myBusiness.id),
        getEmployees(myBusiness.id),
      ]);
      return {
        business: myBusiness,
        plan: planLimits,
        employeeCount: employees.length,
        isOwner: work?.isOwner ?? false,
        myPermissions: employees.find((e) => e.user_id === profile.id) ?? null,
      };
    },
  );
  const business = data?.business ?? null;
  const plan = data?.plan ?? null;
  const employeeCount = data?.employeeCount ?? 0;
  const isOwner = data?.isOwner ?? false;
  const myPermissions = data?.myPermissions ?? null;
  // El dueño siempre ve todo -- para el staff, cada entrada del menú se
  // muestra solo si tiene el permiso correspondiente (o si por algún motivo
  // no se encontró su fila de permisos todavía, se oculta por seguridad en
  // vez de mostrar de más mientras carga).
  const canView = (flag: keyof EmployeeWithUser) => isOwner || myPermissions?.[flag] === true;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await reload();
    } catch (err) {
      console.error('refresh business config error', err);
    } finally {
      setRefreshing(false);
    }
  }

  // Manual, para cuando el chequeo automático de expo-updates se queda
  // atascado en el dispositivo (visto en producción: forzar detención varias
  // veces no lo destrababa, solo desinstalar/reinstalar) -- da una forma de
  // reintentar sin llegar a ese extremo.
  async function handleCheckForUpdate() {
    if (checkingUpdate) return;
    if (!Updates.isEnabled) {
      Alert.alert('No disponible', 'Las actualizaciones OTA no están activas en este build.');
      return;
    }
    setCheckingUpdate(true);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (!result.isAvailable) {
        Alert.alert('Ya estás al día', 'No hay ninguna actualización nueva disponible.');
        return;
      }
      await Updates.fetchUpdateAsync();
      Alert.alert(
        'Actualización descargada',
        'Se descargó una versión nueva. ¿Reiniciar la app ahora para aplicarla?',
        [
          { text: 'Más tarde', style: 'cancel' },
          { text: 'Reiniciar ahora', onPress: () => Updates.reloadAsync() },
        ],
      );
    } catch (err) {
      console.error('check for update error', err);
      Alert.alert('Error', 'No se pudo buscar actualizaciones. Intenta de nuevo más tarde.');
    } finally {
      setCheckingUpdate(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (err) {
      console.error('sign out error', err);
      setSigningOut(false);
    }
  }

  function handleToggleDeactivated() {
    if (!business) return;
    const goingInactive = !business.is_deactivated;
    Alert.alert(
      goingInactive ? 'Desactivar negocio' : 'Reactivar negocio',
      goingInactive
        ? 'Tu negocio dejará de aparecer en búsquedas y en solicitudes de auxilio hasta que lo reactives. Nada de tu catálogo, historial o seguidores se borra.'
        : 'Tu negocio volverá a aparecer en búsquedas y solicitudes de auxilio de inmediato.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: goingInactive ? 'Desactivar' : 'Reactivar',
          style: goingInactive ? 'destructive' : 'default',
          onPress: async () => {
            setTogglingDeactivated(true);
            try {
              await setBusinessDeactivated(business.id, goingInactive);
              setData((prev) =>
                prev && prev.business ? { ...prev, business: { ...prev.business, is_deactivated: goingInactive } } : prev
              );
            } catch (err) {
              console.error('toggle business deactivated error', err);
              Alert.alert('Error', 'No se pudo actualizar el estado del negocio. Intenta de nuevo.');
            } finally {
              setTogglingDeactivated(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.placeholder}>No tienes un negocio registrado.</Text>
        <Button
          title="Cerrar sesión"
          variant="secondary"
          onPress={handleSignOut}
          loading={signingOut}
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={[colors.primary]}
        />
      }
    >
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, styles.sectionTitleInRow]}>Mi negocio</Text>
        <View style={styles.planBadge}>
          <Text style={styles.planBadgeText}>
            Plan {plan ? (planLabel[plan.planName] ?? plan.planName) : '...'}
            {business.is_verified ? ' · Verificado' : ''}
          </Text>
        </View>
      </View>
      <View style={styles.menuGroup}>
        <MenuRow
          icon="storefront-outline"
          label="Datos del negocio"
          onPress={() => router.push('/(business)/datos-negocio')}
        />
        {business.business_type === 'workshop' && canView('can_view_aid_settings') && (
          <MenuRow
            icon="car-outline"
            label="Auxilio en carretera"
            onPress={() => router.push('/(business)/auxilio-carretera')}
          />
        )}
        {canView('can_view_schedule') && (
          <MenuRow
            icon="time-outline"
            label="Horario"
            onPress={() => router.push('/(business)/horario')}
          />
        )}
        {isOwner && (
          <MenuRow
            icon="people-circle-outline"
            label="Equipo"
            badge={
              employeeCount > 0
                ? `${employeeCount} persona${employeeCount === 1 ? '' : 's'}`
                : undefined
            }
            onPress={() => router.push('/(business)/empleados')}
          />
        )}
        {canView('can_manage_catalog') && (
          <MenuRow
            icon="grid-outline"
            label="Catálogo"
            onPress={() => router.push('/(business)/catalogo')}
          />
        )}
        {business.business_type === 'workshop' && canView('can_view_agenda') && (
          <MenuRow
            icon="calendar-outline"
            label="Agenda"
            onPress={() => router.push('/(business)/agenda-negocio')}
          />
        )}
        <MenuRow
          icon="people-outline"
          label="Clientes"
          onPress={() => router.push('/(business)/clientes')}
        />
        {business.business_type === 'workshop' && canView('can_view_maintenance_reminders') && (
          <MenuRow
            icon="build-outline"
            label="Recordatorios de mantenimiento"
            onPress={() => router.push('/(business)/mantenimiento-proactivo')}
          />
        )}
        {(business.business_type === 'workshop' ||
          business.business_type === 'store') &&
          canView('can_view_purchases') && (
          <MenuRow
            icon="bag-handle-outline"
            label="Mis compras"
            onPress={() => router.push('/(business)/mis-compras')}
            last
          />
        )}
      </View>

      <Text style={styles.sectionTitle}>Crecimiento</Text>
      <View style={styles.menuGroup}>
        {canView('can_view_stats') && (
          <MenuRow
            icon="stats-chart-outline"
            label="Estadísticas"
            onPress={() => router.push('/(business)/estadisticas')}
          />
        )}
        {ADS_ENABLED && (
          <MenuRow
            icon="megaphone-outline"
            label="Publicidad"
            onPress={() => router.push('/(business)/publicidad')}
          />
        )}
        {canView('can_view_growth') && (
          <MenuRow
            icon="trending-up-outline"
            label="Crece tu negocio"
            onPress={() => router.push('/(business)/crece-tu-negocio')}
            last
          />
        )}
      </View>

      <Text style={styles.sectionTitle}>Plan y cuenta</Text>
      <View style={styles.menuGroup}>
        <MenuRow
          icon="card-outline"
          label="Plan y suscripción"
          badge={plan ? (planLabel[plan.planName] ?? plan.planName) : undefined}
          onPress={() => router.push('/(business)/suscripcion')}
        />
        {isOwner && (
          <MenuRow
            icon="shield-checkmark-outline"
            label="Verificación"
            badge={business.is_verified ? 'Verificado ✓' : undefined}
            onPress={() => router.push('/(business)/verificacion')}
          />
        )}
        <MenuRow
          icon="alert-circle-outline"
          label="Estado de cuenta"
          badge={business.is_limited ? 'Limitado' : undefined}
          badgeDanger={business.is_limited}
          onPress={() => router.push('/(business)/estado-cuenta')}
        />
        <MenuRow
          icon="notifications-outline"
          label="Notificaciones"
          onPress={() => router.push('/(business)/notificaciones-preferencias')}
          last
        />
      </View>

      <Text style={styles.sectionTitle}>General</Text>
      <View style={styles.menuGroup}>
        {isOwner && (
          <MenuRow
            icon={business.is_deactivated ? 'eye-outline' : 'eye-off-outline'}
            label={business.is_deactivated ? 'Reactivar negocio' : 'Desactivar negocio temporalmente'}
            badge={business.is_deactivated ? 'Desactivado' : undefined}
            badgeDanger={business.is_deactivated}
            onPress={togglingDeactivated ? () => {} : handleToggleDeactivated}
          />
        )}
        {isOwner && (
          <MenuRow
            icon="trash-outline"
            label="Eliminar cuenta"
            onPress={() => router.push('/eliminar-cuenta')}
          />
        )}
        {!quickAccess.checking && (
          <MenuRow
            icon={quickAccess.saved ? 'flash' : 'flash-outline'}
            label={quickAccess.saved ? 'Cuenta guardada para inicio rápido' : 'Guardar cuenta para inicio rápido'}
            badge={quickAccess.saved ? '✓' : undefined}
            onPress={quickAccess.working ? undefined : quickAccess.onPress}
          />
        )}
        {/* A propósito NO pasa por handleSignOut -- signOut() revoca en el
            servidor la sesión actual (con cualquier scope), que es la misma
            que está guardada para el inicio rápido. router.replace (no push)
            descarta esta pila de pantallas igual que el logout normal, para
            que nada de esta cuenta siga montado corriendo de fondo mientras
            se cambia de cuenta. */}
        <MenuRow
          icon="swap-horizontal-outline"
          label="Cambiar o agregar cuenta"
          hint="Sin cerrar esta sesión"
          onPress={() => router.replace('/(auth)/login')}
        />
        <MenuRow
          icon="information-circle-outline"
          label="Versión de la app"
          hint={checkingUpdate ? 'Buscando actualizaciones…' : `${buildInfo} · Toca para buscar actualizaciones`}
          badge={appVersion}
          onPress={handleCheckForUpdate}
          last
        />
      </View>

      <View style={styles.divider} />

      <Pressable
        style={({ pressed }) => [
          styles.signOutRow,
          pressed && styles.menuRowPressed,
        ]}
        onPress={handleSignOut}
        disabled={signingOut}
      >
        {signingOut ? (
          <ActivityIndicator size="small" color={colors.danger} />
        ) : (
          <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        )}
        <Text style={styles.signOutLabel}>
          {signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  hint,
  badge,
  badgeDanger,
  onPress,
  last,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  badge?: string;
  badgeDanger?: boolean;
  onPress?: () => void;
  last?: boolean;
}) {
  const content = (
    <>
      <View style={styles.menuRowIconWrap}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.menuRowContent}>
        <Text style={styles.menuRowLabel}>{label}</Text>
        {hint && <Text style={styles.menuRowHint}>{hint}</Text>}
      </View>
      {badge && (
        <Text
          style={[
            styles.menuRowBadge,
            badgeDanger && styles.menuRowBadgeDanger,
          ]}
        >
          {badge}
        </Text>
      )}
      {onPress && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
    </>
  );

  if (!onPress) {
    return <View style={[styles.menuRow, !last && styles.menuRowBorder]}>{content}</View>;
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuRow,
        !last && styles.menuRowBorder,
        pressed && styles.menuRowPressed,
      ]}
      onPress={onPress}
    >
      {content}
    </Pressable>
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
    paddingTop: 6,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 24,
  },
  planBadge: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Fila que junta el título de sección "Mi negocio" con el chip de plan y
  // verificado (esquina superior derecha) -- el margen vertical vive acá en
  // vez de en el Text (sectionTitleInRow lo resetea) para no duplicarlo.
  // Sin marginTop: es el primer elemento del scroll (justo bajo el header),
  // el espacio de arriba lo da solo el paddingTop del contenedor -- el
  // marginTop de 20 que usan sectionTitle/otras secciones es para separarse
  // del bloque anterior, que acá no existe.
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitleInRow: {
    marginTop: 0,
    marginBottom: 0,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuRowPressed: {
    opacity: 0.55,
  },
  menuRowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#FFF1E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRowContent: {
    flex: 1,
  },
  menuRowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  menuRowHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  menuRowBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginRight: 4,
  },
  menuRowBadgeDanger: {
    color: colors.danger,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
  },
  signOutLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.danger,
  },
});
