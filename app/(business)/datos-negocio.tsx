import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { type Region } from 'react-native-maps';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useCachedLoad } from '../../hooks/useCachedLoad';
import { getMyWorkBusiness, updateBusiness } from '../../services/businesses';
import type { Business } from '../../types/database';

const ECUADOR_PROVINCES_DN = [
  'Azuay',
  'Bolívar',
  'Cañar',
  'Carchi',
  'Chimborazo',
  'Cotopaxi',
  'El Oro',
  'Esmeraldas',
  'Galápagos',
  'Guayas',
  'Imbabura',
  'Loja',
  'Los Ríos',
  'Manabí',
  'Morona Santiago',
  'Napo',
  'Orellana',
  'Pastaza',
  'Pichincha',
  'Santa Elena',
  'Santo Domingo de los Tsáchilas',
  'Sucumbíos',
  'Tungurahua',
  'Zamora Chinchipe',
];

interface DatosNegocioData {
  business: Business | null;
  isOwner: boolean;
}

export default function DatosNegocioScreen() {
  const { profile } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const cacheKey = profile ? `datos-negocio-${profile.id}` : null;
  const {
    data,
    loading,
    reload: reloadCache,
    setData,
  } = useCachedLoad<DatosNegocioData>(cacheKey, async () => {
    if (!profile) return { business: null, isOwner: false };
    const work = await getMyWorkBusiness(profile.id);
    return {
      business: work?.business ?? null,
      isOwner: work?.isOwner ?? false,
    };
  });
  const business = data?.business ?? null;
  const isOwner = data?.isOwner ?? false;

  const [name, setName] = useState(() => data?.business?.name ?? '');
  const [description, setDescription] = useState(
    () => data?.business?.description ?? '',
  );
  const [province, setProvince] = useState(
    () => data?.business?.province ?? '',
  );
  const [city, setCity] = useState(() => data?.business?.city ?? '');
  const [address, setAddress] = useState(() => data?.business?.address ?? '');
  const [phone, setPhone] = useState(() => data?.business?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(
    () => data?.business?.whatsapp ?? '',
  );
  const [saving, setSaving] = useState(false);
  const [showProvincePicker, setShowProvincePicker] = useState(false);

  // Map picker
  const [selectedCoords, setSelectedCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(
    data?.business
      ? { latitude: data.business.latitude, longitude: data.business.longitude }
      : null,
  );
  const [mapInitialRegion, setMapInitialRegion] = useState<Region | null>(null);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const pendingRegionRef = useRef<Region | null>(null);

  const didPopulateRef = useRef(!!data?.business);

  function populateForm(b: Business | null) {
    if (!b) return;
    setName(b.name);
    setDescription(b.description ?? '');
    setProvince(b.province ?? '');
    setCity(b.city);
    setAddress(b.address);
    setPhone(b.phone ?? '');
    setWhatsapp(b.whatsapp ?? '');
    setSelectedCoords({ latitude: b.latitude, longitude: b.longitude });
  }

  useEffect(() => {
    // Primera vez que `business` está disponible tras un fetch real (el
    // cache-hit ya se maneja en los inicializadores de useState de arriba).
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
      console.error('refresh datos negocio error', err);
    } finally {
      setRefreshing(false);
    }
  }

  function openMapPicker() {
    const center = selectedCoords ?? { latitude: -0.1807, longitude: -78.4678 };
    const region: Region = {
      ...center,
      latitudeDelta: 0.004,
      longitudeDelta: 0.004,
    };
    pendingRegionRef.current = region;
    setMapInitialRegion(region);
    setShowMapPicker(true);
  }

  function confirmMapLocation() {
    if (pendingRegionRef.current) {
      setSelectedCoords({
        latitude: pendingRegionRef.current.latitude,
        longitude: pendingRegionRef.current.longitude,
      });
    }
    setShowMapPicker(false);
  }

  const isBrand = business?.business_type === 'brand_advertiser';

  async function handleSave() {
    if (!business) return;
    if (!name.trim() || (!isBrand && (!address.trim() || !city.trim()))) {
      Alert.alert('Faltan datos', 'Completa nombre, dirección y ciudad.');
      return;
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
        ...(selectedCoords
          ? {
              latitude: selectedCoords.latitude,
              longitude: selectedCoords.longitude,
            }
          : {}),
      });
      setData((prev) => (prev ? { ...prev, business: updated } : prev));
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

      <TextField
        label="Nombre"
        value={name}
        onChangeText={setName}
        editable={isOwner}
      />
      <TextField
        label="Descripción"
        value={description}
        onChangeText={setDescription}
        multiline
        editable={isOwner}
      />

      {!isBrand && (
        <>
          <Text style={styles.fieldLabel}>Provincia</Text>
          {isOwner ? (
            <Pressable
              style={styles.pickerButton}
              onPress={() => setShowProvincePicker(true)}
            >
              <Text
                style={[
                  styles.pickerButtonText,
                  !province && styles.pickerButtonPlaceholder,
                ]}
              >
                {province || 'Selecciona una provincia'}
              </Text>
              <Ionicons
                name="chevron-down"
                size={16}
                color={colors.textMuted}
              />
            </Pressable>
          ) : (
            <Text style={styles.readOnlyValue}>{province || '—'}</Text>
          )}

          <TextField
            label="Ciudad"
            value={city}
            onChangeText={setCity}
            editable={isOwner}
          />
          <TextField
            label="Dirección"
            value={address}
            onChangeText={setAddress}
            editable={isOwner}
          />
        </>
      )}
      <TextField
        label="Teléfono"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        editable={isOwner}
      />
      <TextField
        label="WhatsApp"
        value={whatsapp}
        onChangeText={setWhatsapp}
        keyboardType="phone-pad"
        editable={isOwner}
      />

      {!isBrand && (
        <Modal
          visible={showProvincePicker}
          transparent
          animationType="slide"
          onRequestClose={() => setShowProvincePicker(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowProvincePicker(false)}
          >
            <View style={styles.modalSheet}>
              <Text style={styles.modalTitle}>Selecciona la provincia</Text>
              <FlatList
                data={ECUADOR_PROVINCES_DN}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.provinceItem,
                      province === item && styles.provinceItemSelected,
                    ]}
                    onPress={() => {
                      setProvince(item);
                      setShowProvincePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.provinceText,
                        province === item && styles.provinceTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {province === item && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={colors.primary}
                      />
                    )}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>
      )}

      {!isBrand && (
        <>
          <Text style={styles.sectionTitle}>Ubicación en el mapa</Text>
          {selectedCoords && (
            <Text style={styles.helperText}>
              Lat: {selectedCoords.latitude.toFixed(5)}, Lng:{' '}
              {selectedCoords.longitude.toFixed(5)}
            </Text>
          )}
          {isOwner ? (
            selectedCoords ? (
              <View style={styles.locationConfirmed}>
                <Ionicons name="checkmark-circle" size={20} color="#22C55E" />
                <Text style={styles.locationConfirmedText}>
                  Ubicación seleccionada
                </Text>
                <Pressable onPress={openMapPicker}>
                  <Text style={styles.locationChangeLink}>Cambiar</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable style={styles.mapPickerButton} onPress={openMapPicker}>
                <Ionicons name="map-outline" size={18} color={colors.primary} />
                <Text style={styles.mapPickerButtonText}>
                  Seleccionar en mapa
                </Text>
              </Pressable>
            )
          ) : null}
        </>
      )}

      {isOwner && (
        <Button
          title="Guardar cambios"
          onPress={handleSave}
          loading={saving}
          style={styles.saveButton}
        />
      )}

      {/* Map picker */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        onRequestClose={() => setShowMapPicker(false)}
      >
        <View style={styles.mapContainer}>
          {mapInitialRegion && (
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={mapInitialRegion}
              onRegionChangeComplete={(r) => {
                pendingRegionRef.current = r;
              }}
            />
          )}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <View style={styles.mapPinWrap}>
              <Ionicons
                name="location-sharp"
                size={48}
                color={colors.primary}
              />
              <View style={styles.mapPinShadow} />
            </View>
          </View>
          <View style={styles.mapHeader}>
            <Pressable
              style={styles.mapCloseBtn}
              onPress={() => setShowMapPicker(false)}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.mapInstructions}>
              Mueve el mapa para posicionar tu negocio
            </Text>
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
