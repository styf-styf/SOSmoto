import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import {
  getMyWorkBusiness,
  setBusinessAvailability,
  updateBusiness,
} from '../../services/businesses';
import type { Business } from '../../types/database';

interface AuxilioCarreteraData {
  business: Business | null;
  isOwner: boolean;
}

export default function AuxilioCarreteraScreen() {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `auxilio-carretera-${profile.id}` : null;
  const {
    data,
    loading,
    reload: reloadCache,
    setData,
  } = useCachedLoad<AuxilioCarreteraData>(cacheKey, async () => {
    if (!profile) return { business: null, isOwner: false };
    const work = await getMyWorkBusiness(profile.id);
    return {
      business: work?.business ?? null,
      isOwner: work?.isOwner ?? false,
    };
  });
  const business = data?.business ?? null;
  const isOwner = data?.isOwner ?? false;

  const [radius, setRadius] = useState(() =>
    data?.business?.aid_radius_km !== null &&
    data?.business?.aid_radius_km !== undefined
      ? String(data.business.aid_radius_km)
      : '',
  );
  const [isAvailable, setIsAvailable] = useState(
    () => data?.business?.is_available_for_aid ?? true,
  );
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [saving, setSaving] = useState(false);

  const didPopulateRef = useRef(!!data?.business);

  function populateForm(b: Business | null) {
    if (!b) return;
    setRadius(b.aid_radius_km !== null ? String(b.aid_radius_km) : '');
    setIsAvailable(b.is_available_for_aid ?? true);
  }

  useEffect(() => {
    if (didPopulateRef.current || !business) return;
    didPopulateRef.current = true;
    populateForm(business);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const result = await reloadCache();
      populateForm(result.business);
    } catch (err) {
      console.error('refresh auxilio carretera error', err);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleToggleAvailability(value: boolean) {
    if (!business) return;
    setTogglingAvailability(true);
    try {
      await setBusinessAvailability(business.id, value);
      setIsAvailable(value);
      setData((prev) =>
        prev && prev.business
          ? {
              ...prev,
              business: { ...prev.business, is_available_for_aid: value },
            }
          : prev,
      );
    } catch (err) {
      console.error('toggle availability error', err);
      Alert.alert('Error', 'No se pudo actualizar la disponibilidad.');
    } finally {
      setTogglingAvailability(false);
    }
  }

  async function handleSave() {
    if (!business) return;
    const parsedRadius = radius.trim() ? Number(radius) : null;
    if (
      parsedRadius !== null &&
      (Number.isNaN(parsedRadius) || parsedRadius <= 0)
    ) {
      Alert.alert('Radio inválido', 'Ingresa un número de km válido.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateBusiness(business.id, {
        aid_radius_km: parsedRadius,
      });
      setData((prev) => (prev ? { ...prev, business: updated } : prev));
      Alert.alert('Guardado', 'Tu radio de cobertura se actualizó.');
    } catch (err) {
      console.error('update aid radius error', err);
      Alert.alert('Error', 'No se pudo guardar el cambio.');
    } finally {
      setSaving(false);
    }
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
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
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
      {!isOwner && (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyText}>
            Solo el dueño del negocio puede editar estos datos.
          </Text>
        </View>
      )}

      <View style={styles.availabilityRow}>
        <View style={styles.availabilityInfo}>
          <Text style={styles.availabilityLabel}>
            {isAvailable ? 'Disponible para auxilios' : 'No disponible'}
          </Text>
          <Text style={styles.availabilityHint}>
            {isAvailable
              ? 'Recibirás solicitudes de clientes cercanos.'
              : 'No aparecerás en nuevas solicitudes de auxilio.'}
          </Text>
        </View>
        <Switch
          value={isAvailable}
          onValueChange={handleToggleAvailability}
          disabled={!isOwner || togglingAvailability}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>

      <TextField
        label="Radio de cobertura (km)"
        placeholder="5"
        keyboardType="numeric"
        value={radius}
        onChangeText={setRadius}
        editable={isOwner}
      />
      <Text style={styles.helperText}>
        Todos los talleres dentro de este radio del cliente reciben su solicitud
        de auxilio al mismo tiempo -- no hay prioridad por plan.
      </Text>

      {isOwner && (
        <Button
          title="Guardar cambios"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      )}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    paddingBottom: 28,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  readOnlyBanner: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.textMuted,
  },
  readOnlyText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  availabilityInfo: {
    flex: 1,
  },
  availabilityLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  availabilityHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: 16,
  },
  saveButton: {
    marginTop: 8,
  },
});
