import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import MapView, { type Region } from 'react-native-maps';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness, updateBusiness } from '../../services/businesses';
import type { Business } from '../../types/database';

const ECUADOR_PROVINCES_DN = [
  'Azuay', 'Bolívar', 'Cañar', 'Carchi', 'Chimborazo', 'Cotopaxi',
  'El Oro', 'Esmeraldas', 'Galápagos', 'Guayas', 'Imbabura', 'Loja',
  'Los Ríos', 'Manabí', 'Morona Santiago', 'Napo', 'Orellana', 'Pastaza',
  'Pichincha', 'Santa Elena', 'Santo Domingo de los Tsáchilas',
  'Sucumbíos', 'Tungurahua', 'Zamora Chinchipe',
];

export default function DatosNegocioScreen() {
  const { profile } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [radius, setRadius] = useState('');

  const [saving, setSaving] = useState(false);
  const [showProvincePicker, setShowProvincePicker] = useState(false);

  // Map picker
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapInitialRegion, setMapInitialRegion] = useState<Region | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const pendingRegionRef = useRef<Region | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    const myBusiness = work?.business ?? null;
    setBusiness(myBusiness);
    setIsOwner(work?.isOwner ?? false);
    if (!myBusiness) return;
    setName(myBusiness.name);
    setDescription(myBusiness.description ?? '');
    setProvince(myBusiness.province ?? '');
    setCity(myBusiness.city);
    setAddress(myBusiness.address);
    setPhone(myBusiness.phone ?? '');
    setWhatsapp(myBusiness.whatsapp ?? '');
    setRadius(myBusiness.aid_radius_km !== null ? String(myBusiness.aid_radius_km) : '');
    setSelectedCoords({ latitude: myBusiness.latitude, longitude: myBusiness.longitude });
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load datos negocio error', err))
      .finally(() => setLoading(false));
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load().catch((err) => console.error('refresh datos negocio error', err));
    }, [load])
  );

  function openMapPicker() {
    const center = selectedCoords ?? { latitude: -0.1807, longitude: -78.4678 };
    const region: Region = { ...center, latitudeDelta: 0.004, longitudeDelta: 0.004 };
    pendingRegionRef.current = region;
    setMapInitialRegion(region);
    setShowMapPicker(true);
  }

  function confirmMapLocation() {
    if (pendingRegionRef.current) {
      setSelectedCoords({ latitude: pendingRegionRef.current.latitude, longitude: pendingRegionRef.current.longitude });
    }
    setShowMapPicker(false);
  }

  async function handleSave() {
    if (!business) return;
    if (!name.trim() || !address.trim() || !city.trim()) {
      Alert.alert('Faltan datos', 'Completa nombre, dirección y ciudad.');
      return;
    }
    let parsedRadius: number | null = null;
    if (business.business_type === 'workshop') {
      parsedRadius = radius.trim() ? Number(radius) : null;
      if (parsedRadius !== null && (Number.isNaN(parsedRadius) || parsedRadius <= 0)) {
        Alert.alert('Radio inválido', 'Ingresa un número de km válido.');
        return;
      }
    }
    setSaving(true);
    try {
      const updated = await updateBusiness(business.id, {
        name: name.trim(),
        description: description.trim() || null,
        province: province || null,
        city: city.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        aid_radius_km: parsedRadius,
        ...(selectedCoords ? { latitude: selectedCoords.latitude, longitude: selectedCoords.longitude } : {}),
      });
      setBusiness(updated);
      Alert.alert('Guardado', 'Los datos de tu negocio se actualizaron.');
    } catch (err) {
      console.error('update business error', err);
      Alert.alert('Error', 'No se pudo guardar los cambios.');
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
    <ScrollView contentContainerStyle={styles.container}>
      {!isOwner && (
        <View style={styles.readOnlyBanner}>
          <Text style={styles.readOnlyText}>Solo el dueño del negocio puede editar estos datos.</Text>
        </View>
      )}

      <TextField label="Nombre" value={name} onChangeText={setName} editable={isOwner} />
      <TextField label="Descripción" value={description} onChangeText={setDescription} multiline editable={isOwner} />

      <Text style={styles.fieldLabel}>Provincia</Text>
      {isOwner ? (
        <Pressable style={styles.pickerButton} onPress={() => setShowProvincePicker(true)}>
          <Text style={[styles.pickerButtonText, !province && styles.pickerButtonPlaceholder]}>
            {province || 'Selecciona una provincia'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
        </Pressable>
      ) : (
        <Text style={styles.readOnlyValue}>{province || '—'}</Text>
      )}

      <TextField label="Ciudad" value={city} onChangeText={setCity} editable={isOwner} />
      <TextField label="Dirección" value={address} onChangeText={setAddress} editable={isOwner} />
      <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={isOwner} />
      <TextField label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" editable={isOwner} />

      <Modal visible={showProvincePicker} transparent animationType="slide" onRequestClose={() => setShowProvincePicker(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowProvincePicker(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Selecciona la provincia</Text>
            <FlatList
              data={ECUADOR_PROVINCES_DN}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.provinceItem, province === item && styles.provinceItemSelected]}
                  onPress={() => { setProvince(item); setShowProvincePicker(false); }}
                >
                  <Text style={[styles.provinceText, province === item && styles.provinceTextSelected]}>{item}</Text>
                  {province === item && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <Text style={styles.sectionTitle}>Ubicación en el mapa</Text>
      {selectedCoords && (
        <Text style={styles.helperText}>
          Lat: {selectedCoords.latitude.toFixed(5)}, Lng: {selectedCoords.longitude.toFixed(5)}
        </Text>
      )}
      {isOwner ? (
        selectedCoords ? (
          <View style={styles.locationConfirmed}>
            <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
            <Text style={styles.locationConfirmedText}>Ubicación seleccionada</Text>
            <Pressable onPress={openMapPicker}>
              <Text style={styles.locationChangeLink}>Cambiar</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.mapPickerButton} onPress={openMapPicker}>
            <Ionicons name="map-outline" size={18} color={colors.primary} />
            <Text style={styles.mapPickerButtonText}>Seleccionar en mapa</Text>
          </Pressable>
        )
      ) : null}

      {business.business_type === 'workshop' && (
        <>
          <Text style={styles.sectionTitle}>Auxilio en carretera</Text>
          <TextField
            label="Radio de cobertura (km)"
            placeholder="5"
            keyboardType="numeric"
            value={radius}
            onChangeText={setRadius}
            editable={isOwner}
          />
        </>
      )}

      {isOwner && <Button title="Guardar cambios" onPress={handleSave} loading={saving} style={styles.saveButton} />}

      {/* Map picker */}
      <Modal visible={showMapPicker} animationType="slide" onRequestClose={() => setShowMapPicker(false)}>
        <View style={styles.mapContainer}>
          {mapInitialRegion && (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={mapInitialRegion}
              onRegionChangeComplete={(r) => { pendingRegionRef.current = r; }}
            />
          )}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.mapPinWrap}>
              <Ionicons name="location-sharp" size={48} color={colors.primary} />
              <View style={styles.mapPinShadow} />
            </View>
          </View>
          <View style={styles.mapHeader}>
            <Pressable style={styles.mapCloseBtn} onPress={() => setShowMapPicker(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.mapInstructions}>Mueve el mapa para posicionar tu negocio</Text>
          </View>
          <View style={styles.mapFooter}>
            <Button title="Confirmar ubicación" onPress={confirmMapLocation} />
          </View>
        </View>
      </Modal>
    </ScrollView>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 10,
  },
  locationButton: {
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 24,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: colors.surface,
    marginBottom: 16,
  },
  pickerButtonText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerButtonPlaceholder: {
    color: colors.textMuted,
  },
  readOnlyValue: {
    fontSize: 16,
    color: colors.textMuted,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: 16,
    paddingBottom: 28,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  provinceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  provinceItemSelected: {
    backgroundColor: '#FFF1E6',
  },
  provinceText: {
    fontSize: 15,
    color: colors.text,
  },
  provinceTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  locationConfirmed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: '#F0FDF4',
    marginBottom: 12,
  },
  locationConfirmedText: {
    flex: 1,
    fontSize: 15,
    color: '#166534',
    fontWeight: '500',
  },
  locationChangeLink: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  mapPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 12,
    height: 50,
    marginBottom: 12,
    backgroundColor: '#FFF1E6',
  },
  mapPickerButtonText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapPinWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  mapPinShadow: {
    width: 12,
    height: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginTop: -8,
  },
  mapHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 52,
    paddingBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  mapCloseBtn: {
    padding: 4,
  },
  mapInstructions: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  mapFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 16,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
});
