import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { getBusinessClientByName, type ExternalVehicle } from '../../services/businessClients';
import { getVehicles } from '../../services/vehicles';
import {
  createServiceReport,
  type InspectionGroup,
  type ServiceCategory,
  type ServiceReportPart,
} from '../../services/serviceReports';
import type { InspectionStatus } from '../../types/database';

const SERVICE_CATEGORIES: ServiceCategory[] = [
  'Mantenimiento preventivo',
  'Reparación',
  'Diagnóstico',
  'Revisión general',
  'Lavado / Estética',
  'Otro',
];

interface GroupState {
  group: string;
  items: { item: string; status: InspectionStatus }[];
  observations: string;
  collapsed: boolean;
  newItemText: string;
}

const DEFAULT_GROUPS: { group: string; items: string[] }[] = [
  { group: 'Motor', items: ['Nivel de aceite', 'Condición del aceite', 'Refrigerante'] },
  { group: 'Frenos', items: ['Pastillas delanteras', 'Pastillas traseras', 'Líquido de frenos'] },
  { group: 'Transmisión', items: ['Tensión de cadena', 'Desgaste de cadena', 'Piñones'] },
  { group: 'Neumáticos', items: ['Presión delantera', 'Presión trasera', 'Estado del desgaste'] },
  { group: 'Eléctrico', items: ['Batería', 'Luces delanteras', 'Luces traseras', 'Intermitentes'] },
  { group: 'Suspensión', items: ['Horquilla delantera', 'Amortiguador trasero'] },
  { group: 'Filtros', items: ['Filtro de aire', 'Filtro de aceite'] },
];

function buildDefaultGroups(): GroupState[] {
  return DEFAULT_GROUPS.map(({ group, items }) => ({
    group,
    items: items.map((item) => ({ item, status: 'na' as InspectionStatus })),
    observations: '',
    collapsed: true,
    newItemText: '',
  }));
}

const STATUS_OPTIONS: { value: InspectionStatus; label: string; color: string; icon: string }[] = [
  { value: 'ok', label: 'OK', color: '#2ECC71', icon: 'checkmark-circle' },
  { value: 'attention', label: 'Atención', color: colors.warning, icon: 'warning' },
  { value: 'critical', label: 'Crítico', color: colors.danger, icon: 'close-circle' },
  { value: 'na', label: 'N/A', color: colors.textMuted, icon: 'remove-circle-outline' },
];

export default function NuevoInformeScreen() {
  const { profile } = useAuth();
  const params = useLocalSearchParams<{
    appointmentId?: string;
    appointmentStatus?: string;
    clientId?: string;
    helpRequestId?: string;
    clientName?: string;
    vehicleLabel?: string;
    vehiclePlate?: string;
    entryDate?: string;
  }>();

  const isLocked = !!params.appointmentStatus && params.appointmentStatus !== 'completed';

  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loadingBiz, setLoadingBiz] = useState(true);

  const isExternal = !params.clientId;

  // Vehículos del cliente — cargados desde BD (app: tabla vehicles; externo: business_clients)
  const [vehicleOptions, setVehicleOptions] = useState<ExternalVehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<ExternalVehicle | null>(null);

  // Campos del formulario
  const [category, setCategory] = useState<ServiceCategory | null>(null);
  const [serviceKm, setServiceKm] = useState('');
  const [entryDate, setEntryDate] = useState(
    params.entryDate ? new Date(params.entryDate) : new Date()
  );
  const [exitDate, setExitDate] = useState(new Date());
  const [showEntryDatePicker, setShowEntryDatePicker] = useState(false);
  const [showEntryTimePicker, setShowEntryTimePicker] = useState(false);
  const [showExitDatePicker, setShowExitDatePicker] = useState(false);
  const [showExitTimePicker, setShowExitTimePicker] = useState(false);
  const [services, setServices] = useState<string[]>(['']);
  const [parts, setParts] = useState<{ name: string; quantity: string }[]>([]);
  const [groups, setGroups] = useState<GroupState[]>(buildDefaultGroups);
  const [newGroupText, setNewGroupText] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [nextKm, setNextKm] = useState('');
  const [saving, setSaving] = useState(false);

  const loadBusiness = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (work) setBusinessId(work.business.id);
  }, [profile]);

  useEffect(() => {
    loadBusiness()
      .catch((err) => console.error('load biz error', err))
      .finally(() => setLoadingBiz(false));
  }, [loadBusiness]);

  // Cargar vehículos desde BD según tipo de cliente
  useEffect(() => {
    if (!businessId) return;

    if (!isExternal && params.clientId) {
      // Cliente de la app → tabla vehicles
      getVehicles(params.clientId)
        .then((vehs) => {
          const opts: ExternalVehicle[] = vehs.map((v) => ({
            brand: v.brand,
            model: v.model,
            year: v.year,
            plate: (v as any).plate ?? undefined,
          }));
          setVehicleOptions(opts);
          if (opts.length === 1) setSelectedVehicle(opts[0]);
        })
        .catch((err) => console.error('load vehicles error', err));
    } else if (isExternal && params.clientName) {
      // Cliente externo → business_clients
      getBusinessClientByName(businessId, params.clientName)
        .then((record) => {
          if (!record?.vehicles?.length) return;
          setVehicleOptions(record.vehicles);
          if (record.vehicles.length === 1) setSelectedVehicle(record.vehicles[0]);
        })
        .catch((err) => console.error('load crm vehicles error', err));
    }
  }, [isExternal, businessId, params.clientId, params.clientName]);

  function toggleGroup(gi: number) {
    setGroups((prev) => prev.map((g, i) => i === gi ? { ...g, collapsed: !g.collapsed } : g));
  }
  function removeGroup(gi: number) {
    setGroups((prev) => prev.filter((_, i) => i !== gi));
  }
  function addGroup() {
    const name = newGroupText.trim();
    if (!name) return;
    setGroups((prev) => [...prev, { group: name, items: [], observations: '', collapsed: false, newItemText: '' }]);
    setNewGroupText('');
  }
  function setItemStatus(gi: number, ii: number, status: InspectionStatus) {
    setGroups((prev) => prev.map((g, i) => i !== gi ? g : {
      ...g,
      items: g.items.map((it, j) => j === ii ? { ...it, status } : it),
    }));
  }
  function removeItem(gi: number, ii: number) {
    setGroups((prev) => prev.map((g, i) => i !== gi ? g : {
      ...g, items: g.items.filter((_, j) => j !== ii),
    }));
  }
  function addItem(gi: number) {
    const text = groups[gi].newItemText.trim();
    if (!text) return;
    setGroups((prev) => prev.map((g, i) => i !== gi ? g : {
      ...g,
      items: [...g.items, { item: text, status: 'na' }],
      newItemText: '',
    }));
  }
  function updateNewItemText(gi: number, v: string) {
    setGroups((prev) => prev.map((g, i) => i !== gi ? g : { ...g, newItemText: v }));
  }
  function updateGroupObs(gi: number, v: string) {
    setGroups((prev) => prev.map((g, i) => i !== gi ? g : { ...g, observations: v }));
  }

  function addService() {
    setServices((prev) => [...prev, '']);
  }

  function updateService(i: number, v: string) {
    setServices((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  }

  function removeService(i: number) {
    setServices((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addPart() {
    setParts((prev) => [...prev, { name: '', quantity: '1' }]);
  }

  function updatePart(i: number, field: 'name' | 'quantity', v: string) {
    setParts((prev) => prev.map((p, idx) => (idx === i ? { ...p, [field]: v } : p)));
  }

  function removePart(i: number) {
    setParts((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit() {
    if (!businessId) return;

    const validServices = services.map((s) => s.trim()).filter(Boolean);
    if (validServices.length === 0) {
      Alert.alert('Servicios requeridos', 'Agrega al menos un servicio realizado.');
      return;
    }

    const validParts: ServiceReportPart[] = parts
      .filter((p) => p.name.trim())
      .map((p) => ({ name: p.name.trim(), quantity: parseFloat(p.quantity) || 1 }));

    const inspectionGroups: InspectionGroup[] = groups
      .filter((g) => g.items.length > 0)
      .map((g) => ({
        group: g.group,
        observations: g.observations.trim() || null,
        items: g.items,
      }));

    setSaving(true);
    try {
      const report = await createServiceReport({
        businessId,
        clientId: params.clientId || undefined,
        appointmentId: params.appointmentId || undefined,
        helpRequestId: params.helpRequestId || undefined,
        vehicleLabel: selectedVehicle
          ? [selectedVehicle.brand, selectedVehicle.model, String(selectedVehicle.year)].filter(Boolean).join(' ')
          : params.vehicleLabel || undefined,
        externalClientName: isExternal ? params.clientName?.trim() || undefined : undefined,
        serviceCategory: category ?? undefined,
        vehiclePlate: selectedVehicle?.plate?.toUpperCase() || params.vehiclePlate?.toUpperCase() || undefined,
        serviceKm: serviceKm.trim() ? parseInt(serviceKm.trim(), 10) : undefined,
        entryDate: entryDate.toISOString(),
        exitDate: exitDate.toISOString(),
        servicesPerformed: validServices,
        partsUsed: validParts.length > 0 ? validParts : undefined,
        inspectionChecklist: inspectionGroups.length > 0 ? inspectionGroups : undefined,
        observations: serviceDescription.trim() || undefined,
        recommendations: recommendations.trim() || undefined,
        nextMaintenanceKm: nextKm.trim() ? parseInt(nextKm.trim(), 10) : undefined,
      });
      router.replace(`/(business)/informe/${report.id}`);
    } catch (err) {
      console.error('create report error', err);
      Alert.alert('Error', 'No se pudo crear el informe.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingBiz) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {/* Banner de cita no completada */}
      {isLocked && (
        <View style={styles.lockedBanner}>
          <Ionicons name="lock-closed-outline" size={16} color="#F57F17" />
          <Text style={styles.lockedBannerText}>
            La cita aún no está completada. Puedes preparar el informe, pero no podrás guardarlo hasta completarla.
          </Text>
        </View>
      )}

      {/* Cliente y vehículo — solo lectura */}
      {(params.clientName || params.clientId) && (
        <View style={styles.clientBlock}>
          <View style={styles.clientRow}>
            <Ionicons name="person-circle-outline" size={18} color={colors.textMuted} />
            <Text style={styles.clientRowText} numberOfLines={2}>
              {[
                params.clientName,
                selectedVehicle
                  ? [selectedVehicle.brand, selectedVehicle.model, selectedVehicle.year].filter(Boolean).join(' ')
                  : (params.vehicleLabel ?? null),
                selectedVehicle?.plate ?? params.vehiclePlate ?? null,
              ].filter(Boolean).join('  ·  ')}
            </Text>
          </View>

          {/* Chips para elegir vehículo si hay varios */}
          {vehicleOptions.length > 1 && (
            <View style={styles.vehicleChipsRow}>
              {vehicleOptions.map((v, i) => {
                const label = [v.brand, v.model, v.year].filter(Boolean).join(' ');
                const isSel = selectedVehicle === v;
                return (
                  <Pressable
                    key={i}
                    style={[styles.vehicleChip, isSel && styles.vehicleChipSelected]}
                    onPress={() => setSelectedVehicle(v)}
                  >
                    <Ionicons name="bicycle-outline" size={13} color={isSel ? colors.primary : colors.textMuted} />
                    <Text style={[styles.vehicleChipText, isSel && styles.vehicleChipTextSelected]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Fechas de ingreso y salida */}
      <Text style={styles.sectionTitle}>Ingreso y salida</Text>

      {/* Ingreso */}
      <Text style={styles.dateColLabel}>Ingreso</Text>
      <View style={styles.dateRow}>
        <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowEntryDatePicker((p) => !p)}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text style={styles.dateBtnText}>
            {entryDate.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Text>
        </Pressable>
        <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowEntryTimePicker((p) => !p)}>
          <Ionicons name="time-outline" size={15} color={colors.primary} />
          <Text style={styles.dateBtnText}>
            {entryDate.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Pressable>
      </View>

      {/* Salida */}
      <Text style={[styles.dateColLabel, { marginTop: 12 }]}>Salida</Text>
      <View style={styles.dateRow}>
        <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowExitDatePicker((p) => !p)}>
          <Ionicons name="calendar-outline" size={15} color={colors.primary} />
          <Text style={styles.dateBtnText}>
            {exitDate.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}
          </Text>
        </Pressable>
        <Pressable style={[styles.dateBtn, { flex: 1 }]} onPress={() => setShowExitTimePicker((p) => !p)}>
          <Ionicons name="time-outline" size={15} color={colors.primary} />
          <Text style={styles.dateBtnText}>
            {exitDate.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </Pressable>
      </View>

      {showEntryDatePicker && (
        <DateTimePicker
          value={entryDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setShowEntryDatePicker(false);
            if (date) {
              const merged = new Date(entryDate);
              merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              setEntryDate(merged);
            }
          }}
        />
      )}
      {showEntryTimePicker && (
        <DateTimePicker
          value={entryDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setShowEntryTimePicker(false);
            if (date) {
              const merged = new Date(entryDate);
              merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
              setEntryDate(merged);
            }
          }}
        />
      )}
      {showExitDatePicker && (
        <DateTimePicker
          value={exitDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setShowExitDatePicker(false);
            if (date) {
              const merged = new Date(exitDate);
              merged.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
              setExitDate(merged);
            }
          }}
        />
      )}
      {showExitTimePicker && (
        <DateTimePicker
          value={exitDate}
          mode="time"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, date) => {
            if (Platform.OS === 'android') setShowExitTimePicker(false);
            if (date) {
              const merged = new Date(exitDate);
              merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
              setExitDate(merged);
            }
          }}
        />
      )}

      {/* Categoría del servicio */}
      <Text style={styles.sectionTitle}>Categoría del servicio</Text>
      <View style={styles.categoryGrid}>
        {SERVICE_CATEGORIES.map((cat) => (
          <Pressable
            key={cat}
            style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
            onPress={() => setCategory(cat)}
          >
            <Text style={[styles.categoryChipText, category === cat && styles.categoryChipTextActive]}>
              {cat}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Kilometraje */}
      <Text style={styles.sectionTitle}>Kilometraje al momento del servicio</Text>
      <TextInput
        style={styles.lineInput}
        placeholder="Ej. 12500"
        placeholderTextColor={colors.textMuted}
        value={serviceKm}
        onChangeText={setServiceKm}
        keyboardType="numeric"
      />

      {/* Servicios realizados */}
      <Text style={styles.sectionTitle}>Servicios realizados</Text>
      {services.map((svc, i) => (
        <View key={i} style={styles.rowInput}>
          <TextInput
            style={[styles.lineInput, { flex: 1 }]}
            placeholder={`Servicio ${i + 1}`}
            placeholderTextColor={colors.textMuted}
            value={svc}
            onChangeText={(v) => updateService(i, v)}
          />
          {services.length > 1 && (
            <Pressable onPress={() => removeService(i)} style={styles.removeBtn}>
              <Ionicons name="close-circle" size={20} color={colors.danger} />
            </Pressable>
          )}
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addService}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.addBtnText}>Agregar servicio</Text>
      </Pressable>

      {/* Partes/repuestos */}
      <Text style={styles.sectionTitle}>Partes / repuestos usados</Text>
      {parts.map((part, i) => (
        <View key={i} style={styles.rowInput}>
          <TextInput
            style={[styles.lineInput, { flex: 3 }]}
            placeholder="Nombre del repuesto"
            placeholderTextColor={colors.textMuted}
            value={part.name}
            onChangeText={(v) => updatePart(i, 'name', v)}
          />
          <TextInput
            style={[styles.lineInput, { flex: 1 }]}
            placeholder="Cant."
            placeholderTextColor={colors.textMuted}
            value={part.quantity}
            onChangeText={(v) => updatePart(i, 'quantity', v)}
            keyboardType="numeric"
          />
          <Pressable onPress={() => removePart(i)} style={styles.removeBtn}>
            <Ionicons name="close-circle" size={20} color={colors.danger} />
          </Pressable>
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addPart}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.addBtnText}>Agregar repuesto</Text>
      </Pressable>

      {/* Checklist de inspección */}
      <Text style={styles.sectionTitle}>Inspección visual</Text>
      <View style={styles.legendRow}>
        {STATUS_OPTIONS.map((opt) => (
          <View key={opt.value} style={styles.legendItem}>
            <Ionicons name={opt.icon as any} size={14} color={opt.color} />
            <Text style={[styles.legendText, { color: opt.color }]}>{opt.label}</Text>
          </View>
        ))}
      </View>

      {groups.map((grp, gi) => (
        <View key={gi} style={styles.checkGroup}>
          {/* Encabezado de sección — toca para colapsar */}
          <Pressable style={styles.checkGroupHeader} onPress={() => toggleGroup(gi)}>
            <Text style={styles.checkGroupTitle}>{grp.group}</Text>
            <View style={styles.checkGroupHeaderActions}>
              <Pressable onPress={() => removeGroup(gi)} hitSlop={8}>
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
              </Pressable>
              <Ionicons
                name={grp.collapsed ? 'chevron-down-outline' : 'chevron-up-outline'}
                size={18}
                color={colors.textMuted}
              />
            </View>
          </Pressable>

          {!grp.collapsed && (
            <>
              {grp.items.map((it, ii) => (
                <View key={ii} style={styles.checkRow}>
                  <Pressable onPress={() => removeItem(gi, ii)} hitSlop={8} style={styles.removeItemBtn}>
                    <Ionicons name="remove-circle-outline" size={16} color={colors.danger} />
                  </Pressable>
                  <Text style={styles.checkItemLabel}>{it.item}</Text>
                  <View style={styles.checkBtns}>
                    {STATUS_OPTIONS.map((opt) => (
                      <Pressable
                        key={opt.value}
                        style={[styles.checkBtn, it.status === opt.value && { backgroundColor: opt.color }]}
                        onPress={() => setItemStatus(gi, ii, opt.value)}
                      >
                        <Ionicons
                          name={opt.icon as any}
                          size={18}
                          color={it.status === opt.value ? '#fff' : opt.color}
                        />
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}

              {/* Agregar ítem */}
              <View style={styles.addItemRow}>
                <TextInput
                  style={[styles.lineInput, { flex: 1, marginTop: 8 }]}
                  placeholder="Nuevo ítem..."
                  placeholderTextColor={colors.textMuted}
                  value={grp.newItemText}
                  onChangeText={(v) => updateNewItemText(gi, v)}
                  onSubmitEditing={() => addItem(gi)}
                  returnKeyType="done"
                />
                <Pressable onPress={() => addItem(gi)} hitSlop={8}>
                  <Ionicons name="add-circle" size={28} color={colors.primary} />
                </Pressable>
              </View>

              {/* Observaciones de la sección */}
              <TextInput
                style={[styles.textarea, { marginTop: 8, minHeight: 60 }]}
                placeholder="Observaciones de esta sección..."
                placeholderTextColor={colors.textMuted}
                value={grp.observations}
                onChangeText={(v) => updateGroupObs(gi, v)}
                multiline
                textAlignVertical="top"
              />
            </>
          )}
        </View>
      ))}

      {/* Agregar nueva sección */}
      <View style={styles.addItemRow}>
        <TextInput
          style={[styles.lineInput, { flex: 1 }]}
          placeholder="Nueva sección (ej. Carburador)"
          placeholderTextColor={colors.textMuted}
          value={newGroupText}
          onChangeText={setNewGroupText}
          onSubmitEditing={addGroup}
          returnKeyType="done"
        />
        <Pressable onPress={addGroup} hitSlop={8}>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </Pressable>
      </View>

      {/* Descripción del servicio */}
      <Text style={styles.sectionTitle}>Descripción del servicio</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Describe el trabajo realizado..."
        placeholderTextColor={colors.textMuted}
        value={serviceDescription}
        onChangeText={setServiceDescription}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Recomendaciones */}
      <Text style={styles.sectionTitle}>Recomendaciones</Text>
      <TextInput
        style={styles.textarea}
        placeholder="¿Qué se debe hacer en la próxima visita?"
        placeholderTextColor={colors.textMuted}
        value={recommendations}
        onChangeText={setRecommendations}
        multiline
        numberOfLines={3}
        textAlignVertical="top"
      />

      {/* Próximo mantenimiento */}
      <Text style={styles.sectionTitle}>Próximo mantenimiento (opcional)</Text>
      <TextInput
        style={styles.lineInput}
        placeholder="Kilometraje aproximado (ej. 15000)"
        placeholderTextColor={colors.textMuted}
        value={nextKm}
        onChangeText={setNextKm}
        keyboardType="numeric"
      />

      <Button
        title="Crear y enviar informe"
        onPress={handleSubmit}
        loading={saving}
        disabled={isLocked}
        style={styles.submitBtn}
      />
      {isLocked && (
        <Text style={styles.lockedHint}>Completa la cita para poder guardar el informe.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { padding: 20, backgroundColor: colors.background, paddingBottom: 40 },
  subtitle: { fontSize: 14, color: colors.textMuted, marginBottom: 4 },
  clientRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  clientRowText: { flex: 1, fontSize: 14, color: colors.textMuted },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 10 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.surface,
  },
  categoryChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  categoryChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  categoryChipTextActive: { color: '#fff' },
  lineInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: colors.text, backgroundColor: colors.surface,
  },
  rowInput: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  removeBtn: { padding: 2 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  legendRow: { flexDirection: 'row', gap: 14, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 12, fontWeight: '600' },
  checkGroup: {
    backgroundColor: colors.surface, borderRadius: 12, marginBottom: 10, overflow: 'hidden',
  },
  checkGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 14,
  },
  checkGroupHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkGroupTitle: { fontSize: 13, fontWeight: '700', color: colors.text, flex: 1 },
  checkRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 6, paddingHorizontal: 14,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  removeItemBtn: { marginRight: 8 },
  checkItemLabel: { flex: 1, fontSize: 13, color: colors.text },
  checkBtns: { flexDirection: 'row', gap: 6 },
  checkBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  addItemRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingBottom: 10,
  },
  textarea: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: colors.text, backgroundColor: colors.surface, minHeight: 90,
  },
  clientBlock: { marginBottom: 16, gap: 8 },
  vehicleChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  vehicleChipSelected: { borderColor: colors.primary, backgroundColor: '#FFF1E6' },
  vehicleChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  vehicleChipTextSelected: { color: colors.primary },
  vehicleRow: { flexDirection: 'row', gap: 8 },
  dateRow: { flexDirection: 'row', gap: 10 },
  dateCol: { flex: 1 },
  dateColLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginBottom: 6 },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  dateBtnText: { fontSize: 13, color: colors.text, flex: 1 },
  submitBtn: { marginTop: 28 },
  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FFD54F',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  lockedBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#F57F17',
    lineHeight: 18,
  },
  lockedHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },
});
