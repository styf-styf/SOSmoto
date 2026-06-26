import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { createAd, getBusinessAds, pauseAd } from '../../services/ads';
import { getMyWorkBusiness } from '../../services/businesses';
import { pickAndUploadBusinessImage } from '../../services/storage';
import type { Ad } from '../../types/database';

const statusLabel: Record<Ad['status'], string> = {
  pending_review: 'Pendiente de revisión',
  approved: 'Aprobada',
  active: 'Activa',
  rejected: 'Rechazada',
  expired: 'Finalizada',
};

const statusColor: Record<Ad['status'], string> = {
  pending_review: colors.warning,
  approved: colors.success,
  active: colors.success,
  rejected: colors.danger,
  expired: colors.textMuted,
};

export default function PublicidadScreen() {
  const { profile } = useAuth();
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [durationDays, setDurationDays] = useState('7');
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    if (!work) return;
    setBusinessId(work.business.id);
    setIsOwner(work.isOwner);
    setAds(await getBusinessAds(work.business.id));
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load publicidad error', err))
      .finally(() => setLoading(false));
  }, [load]);

  async function handlePickImage() {
    if (!businessId) return;
    setUploadingImage(true);
    try {
      const url = await pickAndUploadBusinessImage(businessId);
      if (url) setImageUrl(url);
    } catch (err) {
      console.error('upload ad image error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir la imagen.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleCreate() {
    if (!businessId) return;
    if (!title.trim() || !imageUrl.trim()) {
      Alert.alert('Faltan datos', 'Completa el título y selecciona una imagen para el banner.');
      return;
    }
    if (linkUrl.trim() && !/^(https?:\/\/|tel:|mailto:)/i.test(linkUrl.trim())) {
      Alert.alert(
        'Link inválido',
        'El link debe ser una URL completa, por ejemplo https://wa.me/593..., https://tusitio.com, tel:+593... o mailto:correo@...'
      );
      return;
    }
    const parsedDays = Number(durationDays);
    if (Number.isNaN(parsedDays) || parsedDays <= 0) {
      Alert.alert('Duración inválida', 'Ingresa un número de días válido.');
      return;
    }
    setSaving(true);
    try {
      const ad = await createAd({
        businessId,
        title: title.trim(),
        imageUrl: imageUrl.trim(),
        linkUrl: linkUrl.trim() || undefined,
        durationDays: parsedDays,
      });
      setAds((prev) => [ad, ...prev]);
      setTitle('');
      setImageUrl('');
      setLinkUrl('');
      setDurationDays('7');
      setShowForm(false);
      Alert.alert('Campaña creada', 'Tu banner ya está activo en el inicio de los clientes.');
    } catch (err) {
      console.error('create ad error', err);
      Alert.alert('Error', 'No se pudo crear la campaña.');
    } finally {
      setSaving(false);
    }
  }

  async function handlePause(ad: Ad) {
    try {
      const updated = await pauseAd(ad.id);
      setAds((prev) => prev.map((a) => (a.id === ad.id ? updated : a)));
    } catch (err) {
      console.error('pause ad error', err);
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Publicidad</Text>
      <Text style={styles.helperText}>
        Banner en el inicio de los clientes. Sin pasarela de pago todavía: la campaña queda activa de inmediato, sin
        costo.
      </Text>

      {!isOwner && <Text style={styles.helperText}>Solo el dueño del negocio puede crear campañas.</Text>}

      {isOwner && !showForm && (
        <Button title="+ Crear campaña" onPress={() => setShowForm(true)} style={styles.createButton} />
      )}

      {isOwner && showForm && (
        <View style={styles.card}>
          <TextField label="Título" placeholder="20% de descuento en cambio de aceite" value={title} onChangeText={setTitle} />

          <Text style={styles.fieldLabel}>Imagen del banner</Text>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.preview} resizeMode="cover" />
          ) : null}
          <Button
            title={imageUrl ? 'Cambiar imagen' : 'Seleccionar imagen'}
            variant="secondary"
            onPress={handlePickImage}
            loading={uploadingImage}
            style={styles.imageButton}
          />

          <TextField
            label="Link al tocar el banner (opcional)"
            placeholder="https://wa.me/..."
            value={linkUrl}
            onChangeText={setLinkUrl}
            autoCapitalize="none"
          />
          <TextField
            label="Duración (días)"
            keyboardType="numeric"
            value={durationDays}
            onChangeText={setDurationDays}
          />
          <View style={styles.editActions}>
            <Button title="Crear" onPress={handleCreate} loading={saving} style={styles.flexButton} />
            <Button title="Cancelar" variant="secondary" onPress={() => setShowForm(false)} style={styles.flexButton} />
          </View>
        </View>
      )}

      <Text style={styles.sectionTitle}>Tus campañas</Text>
      {ads.length === 0 ? (
        <Text style={styles.placeholder}>Todavía no has creado ninguna campaña.</Text>
      ) : (
        ads.map((ad) => (
          <View key={ad.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{ad.title}</Text>
              <Text style={[styles.statusBadge, { color: statusColor[ad.status] }]}>{statusLabel[ad.status]}</Text>
            </View>
            <Text style={styles.cardMeta}>
              {new Date(ad.starts_at).toLocaleDateString('es-EC')} – {new Date(ad.ends_at).toLocaleDateString('es-EC')}
            </Text>
            <Text style={styles.cardMeta}>
              {ad.impressions} impresiones · {ad.clicks} clics
            </Text>
            {(ad.status === 'active' || ad.status === 'approved') && isOwner && (
              <Button
                title="Pausar campaña"
                variant="secondary"
                onPress={() => handlePause(ad)}
                style={styles.pauseButton}
              />
            )}
          </View>
        ))
      )}
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
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
  },
  createButton: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  preview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.background,
  },
  imageButton: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
    marginBottom: 8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    fontSize: 12,
    fontWeight: '700',
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  flexButton: {
    flex: 1,
  },
  pauseButton: {
    marginTop: 12,
  },
});
