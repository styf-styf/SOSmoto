import { useLocalSearchParams } from 'expo-router';
import { AdDetail } from '../../../components/AdDetail';

export default function BusinessAdDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AdDetail adId={id} />;
}
