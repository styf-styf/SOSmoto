import { useLocalSearchParams } from 'expo-router';
import { NegocioCatalogoView } from '../../../components/NegocioCatalogoView';

export default function NegocioCatalogoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <NegocioCatalogoView businessId={id} hrefBase="/(client)" />;
}
