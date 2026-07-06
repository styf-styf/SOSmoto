import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { useLocation } from '../../hooks/useLocation';
import { getMyWorkBusiness, updateBusiness } from '../../services/businesses';
import type { Business } from '../../types/database';

export default function DatosNegocioScreen() {
  const { profile } = useAuth();
  const { getCoords } = useLocation();

  const [business, setBusiness] = useState<Business | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [radius, setRadius] = useState('');

  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    const myBusiness = work?.business ?? null;
    setBusiness(myBusiness);
    setIsOwner(work?.isOwner ?? false);
    if (!myBusiness) return;
    setName(myBusiness.name);
    setDescription(myBusiness.description ?? '');
    setAddress(myBusiness.address);
    setCity(myBusiness.city);
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
        address: address.trim(),
        city: city.trim(),
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
      <TextField label="Dirección" value={address} onChangeText={setAddress} editable={isOwner} />
      <TextField label="Ciudad" value={city} onChangeText={setCity} editable={isOwner} />
      <TextField label="Teléfono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={isOwner} />
      <TextField label="WhatsApp" value={whatsapp} onChangeText={setWhatsapp} keyboardType="phone-pad" editable={isOwner} />

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
});
