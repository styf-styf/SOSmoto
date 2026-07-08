import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
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
  const { getCoords } = useLocation();

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
  const [locating, setLocating] = useState(false);
  const [showProvincePicker, setShowProvincePicker] = useState(false);

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

  async function handleUpdateLocation() {
    setLocating(true);
    try {
      await getCoords();
      Alert.alert('Listo', 'Se obtuvo tu ubicación actual. Guarda los cambios para aplicarla.');
    } catch {
      Alert.alert('No se pudo obtener tu ubicación', 'Activa el GPS y el permiso de ubicación.');
    } finally {
      setLocating(false);
    }
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
      let coordsUpdate = {};
      try {
        const coords = await getCoords();
        coordsUpdate = { latitude: coords.latitude, longitude: coords.longitude };
      } catch {
        // mantiene la ubicación anterior si no se pudo obtener una nueva
      }
      const updated = await updateBusiness(business.id, {
        name: name.trim(),
        description: description.trim() || null,
        province: province || null,
        city: city.trim(),
        address: address.trim(),
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        aid_radius_km: parsedRadius,
        ...coordsUpdate,
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

      <Text style={styles.sectionTitle}>Ubicación</Text>
      <Text style={styles.helperText}>
        Lat: {business.latitude.toFixed(5)}, Lng: {business.longitude.toFixed(5)}
      </Text>
      {isOwner && (
        <Button
          title={locating ? 'Obteniendo ubicación…' : 'Actualizar con mi ubicación actual'}
          variant="secondary"
          onPress={handleUpdateLocation}
          loading={locating}
          style={styles.locationButton}
        />
      )}

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
});
