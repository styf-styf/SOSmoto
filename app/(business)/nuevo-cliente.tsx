import { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getMyWorkBusiness } from '../../services/businesses';
import { addAppClient, addExternalClient, isAppClientAdded, type ExternalVehicle } from '../../services/businessClients';
import { searchUsers, type UserSearchResult } from '../../services/history';
import { getVehicles } from '../../services/vehicles';

type Mode = 'search' | 'external';

interface VehicleForm {
  brand: string;
  model: string;
  year: string;
  plate: string;
}

interface NuevoClienteData {
  businessId: string | null;
  businessName: string;
}

export default function NuevoClienteScreen() {
  const { profile } = useAuth();

  const cacheKey = profile ? `nuevo-cliente-${profile.id}` : null;
  const { data, loading: loadingBiz } = useCachedLoad<NuevoClienteData>(cacheKey, async () => {
    if (!profile) return { businessId: null, businessName: '' };
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return { businessId: null, businessName: '' };
    return { businessId: work.business.id, businessName: work.business.name };
  });
  const businessId = data?.businessId ?? null;
  const businessName = data?.businessName ?? '';

  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<UserSearchResult[]>([]);
  const [selected, setSelected] = useState<UserSearchResult | null>(null);
  const [selectedVehicles, setSelectedVehicles] = useState<{ brand: string; model: string; year: number; plate?: string }[]>([]);
  const [alreadyAdded, setAlreadyAdded] = useState(false);
  const [saving, setSaving] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Formulario externo
  const [extName, setExtName] = useState('');
  const [extPhone, setExtPhone] = useState('');
  const [extEmail, setExtEmail] = useState('');
  const [vehicles, setVehicles] = useState<VehicleForm[]>([]);

  function handleQueryChange(text: string) {
    setQuery(text);
    setSelected(null);
    setSuggestions([]);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!text.trim() || text.trim().length < 2) return;
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const results = await searchUsers(text);
        setSuggestions(results);
      } catch (err) {
        console.error('search error', err);
      } finally {
        setSearching(false);
      }
    }, 400);
  }

  async function handleSelectUser(user: UserSearchResult) {
    setSelected(user);
    setSuggestions([]);
    setQuery(user.full_name);
    setAlreadyAdded(false);
    if (!businessId) return;
    try {
      const [vehs, already] = await Promise.all([
        getVehicles(user.id),
        isAppClientAdded(businessId, user.id),
      ]);
      setSelectedVehicles(vehs.map((v) => ({
        brand: v.brand,
        model: v.model,
        year: v.year,
        plate: (v as any).plate ?? undefined,
      })));
      setAlreadyAdded(already);
    } catch (err) {
      console.error('fetch client data error', err);
    }
  }

  async function handleAddAppClient() {
    if (!businessId || !selected) return;
    setSaving(true);
    try {
      await addAppClient(businessId, selected.id, businessName);
      Alert.alert(
        'Invitación enviada',
        `Se notificó a ${selected.full_name}. Aparecerá en "Mis clientes" como Pendiente hasta que acepte.`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (err) {
      console.error('add app client error', err);
      Alert.alert('Error', 'No se pudo enviar la invitación.');
    } finally {
      setSaving(false);
    }
  }

  function addVehicle() {
    setVehicles((prev) => [...prev, { brand: '', model: '', year: '', plate: '' }]);
  }

  function updateVehicle(i: number, field: keyof VehicleForm, val: string) {
    setVehicles((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: val } : v));
  }

  function removeVehicle(i: number) {
    setVehicles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleAddExternal() {
    if (!businessId) return;
    if (!extName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del cliente.');
      return;
    }
    const parsedVehicles: ExternalVehicle[] = vehicles
      .filter((v) => v.brand.trim() || v.model.trim())
      .map((v) => ({
        brand: v.brand.trim(),
        model: v.model.trim(),
        year: parseInt(v.year, 10) || new Date().getFullYear(),
        plate: v.plate.trim() || undefined,
      }));

    setSaving(true);
    try {
      await addExternalClient({
        businessId,
        name: extName.trim(),
        phone: extPhone.trim() || undefined,
        email: extEmail.trim() || undefined,
        vehicles: parsedVehicles,
      });
      router.replace(
        `/(business)/cliente-externo?name=${encodeURIComponent(extName.trim())}` +
        (extPhone.trim() ? `&phone=${encodeURIComponent(extPhone.trim())}` : '')
      );
    } catch (err) {
      console.error('add external client error', err);
      Alert.alert('Error', 'No se pudo agregar el cliente.');
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
      {/* Tabs: buscar en app / externo */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, mode === 'search' && styles.tabActive]}
          onPress={() => setMode('search')}
        >
          <Text style={[styles.tabText, mode === 'search' && styles.tabTextActive]}>Buscar en la app</Text>
        </Pressable>
        <Pressable
          style={[styles.tab, mode === 'external' && styles.tabActive]}
          onPress={() => setMode('external')}
        >
          <Text style={[styles.tabText, mode === 'external' && styles.tabTextActive]}>Cliente externo</Text>
        </Pressable>
      </View>

      {/* ── MODO BÚSQUEDA APP ── */}
      {mode === 'search' && (
        <>
          <Text style={styles.hint}>
            Busca al cliente por nombre. Si está registrado en la app, sus datos y vehículos se importan automáticamente.
          </Text>

          <TextInput
            style={styles.searchInput}
            placeholder="Nombre del cliente…"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={handleQueryChange}
            autoFocus
          />

          {searching && (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />
          )}

          {suggestions.length > 0 && !selected && (
            <View style={styles.suggestionBox}>
              {suggestions.map((u) => (
                <Pressable key={u.id} style={styles.suggestionRow} onPress={() => handleSelectUser(u)}>
                  <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.suggestionName}>{u.full_name}</Text>
                    {u.phone && <Text style={styles.suggestionPhone}>{u.phone}</Text>}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {selected && (
            <View style={styles.selectedCard}>
              <View style={styles.selectedHeader}>
                <Ionicons name="person" size={28} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedName}>{selected.full_name}</Text>
                  {selected.phone && <Text style={styles.selectedSub}>{selected.phone}</Text>}
                </View>
                <Pressable onPress={() => { setSelected(null); setQuery(''); setSelectedVehicles([]); setAlreadyAdded(false); }}>
                  <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                </Pressable>
              </View>

              {selectedVehicles.length > 0 && (
                <>
                  <Text style={styles.vehiclesLabel}>Vehículos registrados</Text>
                  {selectedVehicles.map((v, i) => (
                    <View key={i} style={styles.vehicleChip}>
                      <Ionicons name="bicycle-outline" size={14} color={colors.textMuted} />
                      <Text style={styles.vehicleChipText}>
                        {[v.brand, v.model, v.year, v.plate].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {alreadyAdded ? (
                <View style={styles.alreadyRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#2ECC71" />
                  <Text style={styles.alreadyText}>Ya está en tu lista de clientes</Text>
                  <Pressable onPress={() => router.replace(`/(business)/cliente/${selected!.id}`)}>
                    <Text style={styles.alreadyLink}>Ver perfil →</Text>
                  </Pressable>
                </View>
              ) : (
                <Button
                  title="Agregar al CRM"
                  onPress={handleAddAppClient}
                  loading={saving}
                  style={{ marginTop: 16 }}
                />
              )}
            </View>
          )}

          {!selected && !searching && query.length >= 2 && suggestions.length === 0 && (
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No encontrado en la app.</Text>
              <Pressable onPress={() => { setMode('external'); setExtName(query); }}>
                <Text style={styles.noResultsLink}>Agregar como cliente externo →</Text>
              </Pressable>
            </View>
          )}
        </>
      )}

      {/* ── MODO EXTERNO ── */}
      {mode === 'external' && (
        <>
          <Text style={styles.hint}>
            Ingresa los datos del cliente. Podrás usarlos al crear informes sin tener que escribirlos cada vez.
          </Text>

          <Text style={styles.label}>Nombre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre completo"
            placeholderTextColor={colors.textMuted}
            value={extName}
            onChangeText={setExtName}
          />

          <Text style={styles.label}>Teléfono</Text>
          <TextInput
            style={styles.input}
            placeholder="0987654321"
            placeholderTextColor={colors.textMuted}
            value={extPhone}
            onChangeText={setExtPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="correo@ejemplo.com"
            placeholderTextColor={colors.textMuted}
            value={extEmail}
            onChangeText={setExtEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.vehiclesHeader}>
            <Text style={styles.label}>Vehículos</Text>
            <Pressable style={styles.addVehicleBtn} onPress={addVehicle}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addVehicleBtnText}>Agregar</Text>
            </Pressable>
          </View>

          {vehicles.map((v, i) => (
            <View key={i} style={styles.vehicleForm}>
              <View style={styles.vehicleFormHeader}>
                <Text style={styles.vehicleFormTitle}>Vehículo {i + 1}</Text>
                <Pressable onPress={() => removeVehicle(i)}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              </View>
              <View style={styles.vehicleRow}>
                <TextInput
                  style={[styles.input, { flex: 3 }]}
                  placeholder="Marca"
                  placeholderTextColor={colors.textMuted}
                  value={v.brand}
                  onChangeText={(val) => updateVehicle(i, 'brand', val)}
                />
                <TextInput
                  style={[styles.input, { flex: 3 }]}
                  placeholder="Modelo"
                  placeholderTextColor={colors.textMuted}
                  value={v.model}
                  onChangeText={(val) => updateVehicle(i, 'model', val)}
                />
                <TextInput
                  style={[styles.input, { flex: 2 }]}
                  placeholder="Año"
                  placeholderTextColor={colors.textMuted}
                  value={v.year}
                  onChangeText={(val) => updateVehicle(i, 'year', val)}
                  keyboardType="numeric"
                  maxLength={4}
                />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Placa (ej. ABC-1234)"
                placeholderTextColor={colors.textMuted}
                value={v.plate}
                onChangeText={(val) => updateVehicle(i, 'plate', val.toUpperCase())}
                autoCapitalize="characters"
              />
            </View>
          ))}

          <Button
            title="Guardar cliente"
            onPress={handleAddExternal}
            loading={saving}
            style={{ marginTop: 24 }}
          />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { padding: 20, backgroundColor: colors.background, paddingBottom: 40 },
  tabs: {
    flexDirection: 'row', backgroundColor: colors.surface,
    borderRadius: 12, padding: 4, marginBottom: 20,
  },
  tab: {
    flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10,
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: '#fff' },
  hint: { fontSize: 13, color: colors.textMuted, marginBottom: 16, lineHeight: 19 },
  searchInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 13, fontSize: 15,
    color: colors.text, backgroundColor: colors.surface,
  },
  suggestionBox: {
    marginTop: 6, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, backgroundColor: colors.surface, overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  suggestionName: { fontSize: 14, fontWeight: '600', color: colors.text },
  suggestionPhone: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  selectedCard: {
    marginTop: 12, backgroundColor: colors.surface,
    borderRadius: 14, padding: 16,
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  selectedHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  selectedName: { fontSize: 16, fontWeight: '700', color: colors.text },
  selectedSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  vehiclesLabel: {
    fontSize: 12, fontWeight: '700', color: colors.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
  },
  vehicleChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.background, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, marginBottom: 6,
  },
  vehicleChipText: { fontSize: 13, color: colors.text },
  alreadyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 16, backgroundColor: '#F0FAF4',
    borderRadius: 10, padding: 12,
  },
  alreadyText: { flex: 1, fontSize: 13, color: '#2ECC71', fontWeight: '600' },
  alreadyLink: { fontSize: 13, color: colors.primary, fontWeight: '700' },
  noResults: { marginTop: 16, alignItems: 'center', gap: 8 },
  noResultsText: { fontSize: 14, color: colors.textMuted },
  noResultsLink: { fontSize: 14, color: colors.primary, fontWeight: '700' },
  label: { fontSize: 13, fontWeight: '700', color: colors.text, marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 14,
    color: colors.text, backgroundColor: colors.surface,
  },
  vehiclesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  addVehicleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addVehicleBtnText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  vehicleForm: {
    backgroundColor: colors.surface, borderRadius: 12,
    padding: 14, marginTop: 10, gap: 8,
  },
  vehicleFormHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  vehicleFormTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
  vehicleRow: { flexDirection: 'row', gap: 8 },
});
