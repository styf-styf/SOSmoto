import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { getMyWorkBusiness } from '../../services/businesses';
import { pickImageFromLibrary, uploadKycDocument } from '../../services/storage';
import { createVerificationRequest, getLatestVerificationRequest } from '../../services/verification';
import type { Business, BusinessVerificationRequest } from '../../types/database';

type DocKind = 'id-document' | 'ruc-document' | 'storefront-photo';

interface DocState {
  previewUri: string | null;
  path: string | null;
  uploading: boolean;
}

const emptyDoc: DocState = { previewUri: null, path: null, uploading: false };

const statusLabel: Record<BusinessVerificationRequest['status'], string> = {
  pending_review: 'En revisión',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export default function VerificacionScreen() {
  const { profile } = useAuth();

  const [business, setBusiness] = useState<Business | null>(null);
  const [latestRequest, setLatestRequest] = useState<BusinessVerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);

  const [idDoc, setIdDoc] = useState<DocState>(emptyDoc);
  const [rucDoc, setRucDoc] = useState<DocState>(emptyDoc);
  const [storefrontPhoto, setStorefrontPhoto] = useState<DocState>(emptyDoc);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const work = await getMyWorkBusiness(profile.id);
    setBusiness(work?.business ?? null);
    if (work?.business) {
      setLatestRequest(await getLatestVerificationRequest(work.business.id));
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load()
        .catch((err) => console.error('load verificacion error', err))
        .finally(() => setLoading(false));
    }, [load])
  );

  async function handlePick(kind: DocKind, setState: (state: DocState) => void) {
    if (!business) return;
    const asset = await pickImageFromLibrary().catch((err) => {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo abrir la galería.');
      return null;
    });
    if (!asset) return;
    setState({ previewUri: asset.uri, path: null, uploading: true });
    try {
      const path = await uploadKycDocument(asset, business.id, kind);
      setState({ previewUri: asset.uri, path, uploading: false });
    } catch (err) {
      console.error('upload kyc document error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo subir el documento.');
      setState(emptyDoc);
    }
  }

  async function handleSubmit() {
    if (!business) return;
    if (!idDoc.path) {
      Alert.alert('Falta un documento', 'Sube una foto de tu cédula o documento de identidad.');
      return;
    }
    if (!storefrontPhoto.path) {
      Alert.alert('Falta una foto', 'Sube una foto del local del negocio.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createVerificationRequest({
        businessId: business.id,
        idDocumentPath: idDoc.path,
        rucDocumentPath: rucDoc.path ?? undefined,
        storefrontPhotoPath: storefrontPhoto.path,
      });
      setLatestRequest(created);
      setIdDoc(emptyDoc);
      setRucDoc(emptyDoc);
      setStorefrontPhoto(emptyDoc);
      Alert.alert('Enviado', 'Tu solicitud de verificación quedó en revisión.');
    } catch (err) {
      console.error('create verification request error', err);
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo enviar la solicitud.');
    } finally {
      setSubmitting(false);
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
        <Text style={styles.placeholder}>Primero crea tu negocio.</Text>
      </View>
    );
  }

  if (business.is_verified) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={48} color={colors.primary} />
        <Text style={styles.statusTitle}>Tu negocio está verificado</Text>
        <Text style={styles.placeholder}>Tu insignia de "verificado" ya es visible para los clientes.</Text>
      </View>
    );
  }

  if (latestRequest?.status === 'pending_review') {
    return (
      <View style={styles.center}>
        <Ionicons name="time-outline" size={48} color={colors.warning} />
        <Text style={styles.statusTitle}>Tu solicitud está en revisión</Text>
        <Text style={styles.placeholder}>
          Enviada el {new Date(latestRequest.created_at).toLocaleDateString('es-EC')}. Te avisaremos cuando se apruebe.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.helperText}>
        Sube tu cédula o RUC y una foto del local. Un admin revisará tu solicitud y, si todo está en orden, tu negocio
        recibirá la insignia de "verificado".
      </Text>

      {latestRequest?.status === 'rejected' && (
        <View style={styles.rejectedBox}>
          <Text style={styles.rejectedTitle}>Tu solicitud anterior fue rechazada</Text>
          {latestRequest.admin_notes && <Text style={styles.rejectedText}>{latestRequest.admin_notes}</Text>}
          <Text style={styles.rejectedText}>Corrige lo necesario y vuelve a enviar.</Text>
        </View>
      )}

      <DocPicker
        label="Cédula o documento de identidad"
        doc={idDoc}
        onPress={() => handlePick('id-document', setIdDoc)}
      />
      <DocPicker label="RUC (opcional)" doc={rucDoc} onPress={() => handlePick('ruc-document', setRucDoc)} />
      <DocPicker
        label="Foto del local"
        doc={storefrontPhoto}
        onPress={() => handlePick('storefront-photo', setStorefrontPhoto)}
      />

      <Button
        title="Enviar para revisión"
        onPress={handleSubmit}
        loading={submitting}
        disabled={idDoc.uploading || rucDoc.uploading || storefrontPhoto.uploading}
        style={styles.submitButton}
      />
    </ScrollView>
  );
}

function DocPicker({ label, doc, onPress }: { label: string; doc: DocState; onPress: () => void }) {
  return (
    <View style={styles.docSection}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {doc.previewUri && <Image source={{ uri: doc.previewUri }} style={styles.preview} resizeMode="cover" />}
      <Button
        title={doc.previewUri ? 'Cambiar foto' : 'Seleccionar foto'}
        variant="secondary"
        onPress={onPress}
        loading={doc.uploading}
        style={styles.pickButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 20,
    gap: 8,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    backgroundColor: colors.background,
  },
  placeholder: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 20,
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  rejectedBox: {
    backgroundColor: '#FBE8E8',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  rejectedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.danger,
    marginBottom: 4,
  },
  rejectedText: {
    fontSize: 13,
    color: colors.text,
  },
  docSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  preview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  pickButton: {},
  submitButton: {
    marginTop: 8,
  },
});
