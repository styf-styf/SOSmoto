import { useLocalSearchParams } from 'expo-router';
import { AdDetail } from '../../../components/AdDetail';

export default function ClientAdDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdDetail adId={id} userRole="client" />;
}
