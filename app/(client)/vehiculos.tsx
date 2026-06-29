import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getDueMaintenance, markCompleted, type MaintenanceItem } from '../../services/maintenance';
import { createVehicle, deleteVehicle, getVehicles, updateMileage } from '../../services/vehicles';
import type { MotoType, Vehicle } from '../../types/database';

const motoTypeLabel: Record<MotoType, string> = {
  scooter: 'Scooter',
  street: 'Street',
  naked: 'Naked',
  enduro: 'Enduro',
  sport: 'Sport',
  cruiser: 'Cruiser',
};

export default function VehiclesScreen() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const result = await getVehicles(profile.id);
    setVehicles(result);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load vehicles error', err))
      .finally(() => setLoading(false));
  }, [load]);

  function handleDelete(vehicle: Vehicle) {
    Alert.alert('Eliminar moto', `¿Eliminar ${vehicle.brand} ${vehicle.model}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVehicle(vehicle.id);
            setVehicles((prev) => prev.filter((v) => v.id !== vehicle.id));
          } catch (err) {
            console.error('delete vehicle error', err);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {vehicles.length === 0 && !showForm && (
        <Text style={styles.placeholder}>Aún no tienes motos registradas.</Text>
      )}

      {vehicles.map((vehicle) => (
        <VehicleCard
          key={vehicle.id}
          vehicle={vehicle}
          onDelete={() => handleDelete(vehicle)}
          onUpdated={(updated) =>
            setVehicles((prev) => prev.map((v) => (v.id === updated.id ? updated : v)))
          }
        />
      ))}

      {showForm ? (
        <AddVehicleForm
          onCancel={() => setShowForm(false)}
          onCreated={(vehicle) => {
            setVehicles((prev) => [vehicle, ...prev]);
            setShowForm(false);
          }}
        />
      ) : (
        <Button title="+ Agregar moto" variant="secondary" onPress={() => setShowForm(true)} />
      )}
    </ScrollView>
  );
}

function VehicleCard({
  vehicle,
  onDelete,
  onUpdated,
}: {
  vehicle: Vehicle;
  onDelete: () => void;
  onUpdated: (vehicle: Vehicle) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [mileage, setMileage] = useState(String(vehicle.current_mileage));
  const [avgMonthlyKm, setAvgMonthlyKm] = useState(
    vehicle.avg_monthly_km !== null ? String(vehicle.avg_monthly_km) : ''
  );
  const [saving, setSaving] = useState(false);
  const [maintenance, setMaintenance] = useState<MaintenanceItem[]>([]);

  useEffect(() => {
    getDueMaintenance(vehicle)
      .then(setMaintenance)
      .catch((err) => console.error('load maintenance error', err));
  }, [vehicle.id, vehicle.current_mileage, vehicle.moto_type]);

  async function handleComplete(item: MaintenanceItem) {
    try {
      await markCompleted(item.suggestion.id, vehicle.current_mileage);
      setMaintenance((prev) => prev.filter((m) => m.suggestion.id !== item.suggestion.id));
    } catch (err) {
      console.error('mark completed error', err);
    }
  }

  async function handleSave() {
    const parsed = Number(mileage);
    if (Number.isNaN(parsed) || parsed < 0) {
      Alert.alert('Kilometraje inválido', 'Ingresa un número válido.');
      return;
    }
    const parsedAvg = avgMonthlyKm.trim() ? Number(avgMonthlyKm) : null;
    if (parsedAvg !== null && (Number.isNaN(parsedAvg) || parsedAvg < 0)) {
      Alert.alert('Promedio inválido', 'Ingresa un número válido.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateMileage(vehicle.id, parsed, parsedAvg);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      console.error('update mileage error', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {vehicle.brand} {vehicle.model} ({vehicle.year})
        </Text>
        <Pressable onPress={onDelete}>
          <Ionicons name="trash-outline" size={20} color={colors.danger} />
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.editForm}>
          <TextField
            label="Kilometraje actual"
            keyboardType="numeric"
            value={mileage}
            onChangeText={setMileage}
          />
          <TextField
            label="Promedio de km que rodas al mes (opcional)"
            placeholder="800"
            keyboardType="numeric"
            value={avgMonthlyKm}
            onChangeText={setAvgMonthlyKm}
          />
          <Text style={styles.helperText}>
            Con este dato te avisamos de tu próximo mantenimiento aunque no abras la app seguido.
          </Text>
          <View style={styles.editActions}>
            <Button title="Guardar" onPress={handleSave} loading={saving} style={styles.flexButton} />
            <Button
              title="Cancelar"
              variant="secondary"
              onPress={() => setEditing(false)}
              style={styles.flexButton}
            />
          </View>
        </View>
      ) : (
        <Pressable onPress={() => setEditing(true)}>
          <Text style={styles.cardMeta}>
            {vehicle.current_mileage.toLocaleString()} km · tocar para actualizar
          </Text>
          {vehicle.avg_monthly_km !== null && (
            <Text style={styles.cardMetaSmall}>~{vehicle.avg_monthly_km.toLocaleString()} km/mes</Text>
          )}
        </Pressable>
      )}

      {!vehicle.moto_type ? null : maintenance.length === 0 ? null : (
        <View style={styles.maintenanceList}>
          {maintenance.map((item) => (
            <View key={item.suggestion.id} style={styles.maintenanceRow}>
              <View style={styles.maintenanceInfo}>
                <Text style={styles.maintenanceName}>{item.rule.service_name}</Text>
                <Text style={[styles.maintenanceMeta, item.isDue && styles.maintenanceOverdue]}>
                  {item.isDue
                    ? `Vencido hace ${Math.abs(item.kmRemaining).toLocaleString()} km`
                    : `Faltan ${item.kmRemaining.toLocaleString()} km`}
                </Text>
              </View>
              <Pressable
                style={styles.maintenanceAction}
                onPress={() =>
                  router.push({ pathname: '/(client)/buscar', params: { service: item.rule.service_name } })
                }
              >
                <Ionicons name="search" size={16} color={colors.primary} />
              </Pressable>
              <Pressable style={styles.maintenanceAction} onPress={() => handleComplete(item)}>
                <Ionicons name="checkmark-done" size={16} color={colors.success} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function AddVehicleForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (vehicle: Vehicle) => void;
}) {
  const { profile } = useAuth();
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [mileage, setMileage] = useState('0');
  const [avgMonthlyKm, setAvgMonthlyKm] = useState('');
  const [motoType, setMotoType] = useState<MotoType>('street');
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!profile) return;
    const parsedYear = Number(year);
    const parsedMileage = Number(mileage);
    if (!brand.trim() || !model.trim() || !parsedYear) {
      Alert.alert('Faltan datos', 'Completa marca, modelo y año.');
      return;
    }
    const parsedAvg = avgMonthlyKm.trim() ? Number(avgMonthlyKm) : undefined;
    if (parsedAvg !== undefined && Number.isNaN(parsedAvg)) {
      Alert.alert('Promedio inválido', 'Ingresa un número válido.');
      return;
    }
    setSaving(true);
    try {
      const vehicle = await createVehicle({
        userId: profile.id,
        brand: brand.trim(),
        model: model.trim(),
        year: parsedYear,
        currentMileage: Number.isNaN(parsedMileage) ? 0 : parsedMileage,
        motoType,
        avgMonthlyKm: parsedAvg,
      });
      onCreated(vehicle);
    } catch (err) {
      console.error('create vehicle error', err);
      Alert.alert('Error', 'No se pudo agregar la moto.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <TextField label="Marca" placeholder="Honda" value={brand} onChangeText={setBrand} />
      <TextField label="Modelo" placeholder="CB190R" value={model} onChangeText={setModel} />
      <TextField label="Año" placeholder="2022" keyboardType="numeric" value={year} onChangeText={setYear} />
      <TextField
        label="Kilometraje actual"
        placeholder="0"
        keyboardType="numeric"
        value={mileage}
        onChangeText={setMileage}
      />
      <TextField
        label="Promedio de km que rodas al mes (opcional)"
        placeholder="800"
        keyboardType="numeric"
        value={avgMonthlyKm}
        onChangeText={setAvgMonthlyKm}
      />
      <Text style={styles.fieldLabel}>Tipo de moto</Text>
      <View style={styles.typeSelector}>
        {(Object.keys(motoTypeLabel) as MotoType[]).map((type) => (
          <Pressable
            key={type}
            onPress={() => setMotoType(type)}
            style={[styles.typeOption, motoType === type && styles.typeOptionSelected]}
          >
            <Text style={[styles.typeOptionText, motoType === type && styles.typeOptionTextSelected]}>
              {motoTypeLabel[type]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.editActions}>
        <Button title="Guardar" onPress={handleCreate} loading={saving} style={styles.flexButton} />
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
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    backgroundColor: colors.background,
    gap: 12,
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
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
  },
  cardMetaSmall: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  helperText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -8,
    marginBottom: 8,
  },
  editForm: {
    marginTop: 8,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
  maintenanceList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    gap: 8,
  },
  maintenanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  maintenanceInfo: {
    flex: 1,
  },
  maintenanceName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  maintenanceMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  maintenanceOverdue: {
    color: colors.danger,
    fontWeight: '600',
  },
  maintenanceAction: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  typeOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF1E6',
  },
  typeOptionText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  typeOptionTextSelected: {
    color: colors.primary,
  },
});
