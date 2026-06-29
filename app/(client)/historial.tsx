import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { createReview, getServiceHistory, type ServiceHistoryItem } from '../../services/reviews';

const statusLabel: Record<string, string> = {
  completed: 'Completado',
  cancelled: 'Cancelado',
};

const kindLabel: Record<ServiceHistoryItem['kind'], string> = {
  help_request: 'Auxilio',
  appointment: 'Cita',
  maintenance: 'Mantenimiento',
};

export default function HistorialScreen() {
  const { profile } = useAuth();
  const [items, setItems] = useState<ServiceHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!profile) return;
    const history = await getServiceHistory(profile.id);
    setItems(history);
  }, [profile]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((err) => console.error('load historial error', err))
      .finally(() => setLoading(false));
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {items.length === 0 ? (
        <Text style={styles.placeholder}>Aún no tienes servicios en tu historial.</Text>
      ) : (
        items.map((item) => <HistoryCard key={`${item.kind}_${item.id}`} item={item} onReviewed={load} />)
      )}
    </ScrollView>
  );
}

function HistoryCard({ item, onReviewed }: { item: ServiceHistoryItem; onReviewed: () => void }) {
  const { profile } = useAuth();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!profile || !item.business) return;
    setSaving(true);
    try {
      await createReview({
        reviewerId: profile.id,
        businessId: item.business.id,
        helpRequestId: item.helpRequestId,
        appointmentId: item.appointmentId,
        rating,
        comment: comment.trim() || undefined,
      });
      setShowForm(false);
      onReviewed();
    } catch (err) {
      console.error('create review error', err);
      Alert.alert('Error', 'No se pudo enviar la calificación.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.title}</Text>
      <Text style={styles.cardMeta}>
        {kindLabel[item.kind]} · {statusLabel[item.status] ?? item.status} ·{' '}
        {new Date(item.createdAt).toLocaleDateString()}
      </Text>
      {item.description && <Text style={styles.cardMeta}>{item.description}</Text>}

      {item.status === 'cancelled' && item.business && !item.review && (
        <Text style={styles.cardMeta}>
          El taller fue asignado pero la solicitud se canceló. Si no se presentó, puedes calificarlo.
        </Text>
      )}

      {(item.status === 'completed' || item.status === 'cancelled') &&
        item.business &&
        (item.review ? (
          <View style={styles.reviewDone}>
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.reviewDoneText}>Calificaste con {item.review.rating} estrellas</Text>
          </View>
        ) : showForm ? (
          <View style={styles.reviewForm}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <Pressable key={value} onPress={() => setRating(value)}>
                  <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={24} color={colors.warning} />
                </Pressable>
              ))}
            </View>
            <TextField label="Comentario (opcional)" value={comment} onChangeText={setComment} />
            <View style={styles.actionsRow}>
              <Button title="Enviar" onPress={handleSubmit} loading={saving} style={styles.flexButton} />
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => setShowForm(false)}
                style={styles.flexButton}
              />
            </View>
          </View>
        ) : (
          <Button title="Calificar" variant="secondary" onPress={() => setShowForm(true)} style={styles.reviewButton} />
        ))}
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
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  reviewDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  reviewDoneText: {
    fontSize: 13,
    color: colors.text,
  },
  reviewForm: {
    marginTop: 12,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  flexButton: {
    flex: 1,
  },
  reviewButton: {
    marginTop: 12,
  },
});
