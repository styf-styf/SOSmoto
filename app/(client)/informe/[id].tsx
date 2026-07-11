import { useCallback, useRef, useState } from 'react';
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
import { shareReportAsPdf } from '../../../utils/reportPdf';

export default function InformeClienteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [report, setReport] = useState<ServiceReportWithBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [sharing, setSharing] = useState(false);
  const didInitialLoadRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      const isInitial = !didInitialLoadRef.current;
      didInitialLoadRef.current = true;
      if (isInitial) setLoading(true);
      getServiceReport(id)
        .then((r) => setReport(r))
        .catch((err) => console.error('load report error', err))
        .finally(() => { if (isInitial) setLoading(false); });
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

  async function handleShare() {
    if (!report) return;
    setSharing(true);
    try {
      await shareReportAsPdf(report);
    } catch (err) {
      console.error('share report error', err);
      Alert.alert('Error', 'No se pudo compartir el informe.');
    } finally {
      setSharing(false);
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
    <ServiceReportView
      report={report}
      footer={
        <>
          {report.client_id && !report.client_confirmed_at && (
            <Button title="Confirmar recibido" onPress={handleConfirm} loading={confirming} />
          )}
          <Button
            title={sharing ? 'Compartiendo…' : 'Compartir PDF del informe'}
            onPress={handleShare}
            loading={sharing}
            variant="secondary"
          />
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
