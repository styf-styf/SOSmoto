import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, View, StyleSheet } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Button } from '../../../components/Button';
import { colors } from '../../../constants/colors';
import {
  confirmServiceReport,
  getServiceReport,
  type ServiceReportWithBusiness,
} from '../../../services/serviceReports';
import { ServiceReportView } from '../../../components/ServiceReportView';

export default function InformeClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<ServiceReportWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      getServiceReport(id)
        .then((r) => setReport(r))
        .catch((err) => console.error('load report error', err))
        .finally(() => setLoading(false));
    }, [id])
  );

  async function handleConfirm() {
    setConfirming(true);
    try {
      await confirmServiceReport(id);
      setReport((prev) => prev ? { ...prev, client_confirmed_at: new Date().toISOString() } : prev);
    } catch (err) {
      console.error('confirm report error', err);
      Alert.alert('Error', 'No se pudo confirmar el recibo.');
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!report) return null;

  return (
    <View style={styles.wrapper}>
      <ServiceReportView report={report} />
      {report.client_id && !report.client_confirmed_at && (
        <View style={styles.footer}>
          <Button
            title="Confirmar recibido"
            onPress={handleConfirm}
            loading={confirming}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  footer: {
    padding: 20,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
