import { useLocalSearchParams } from 'expo-router';
import { ClientProfileView } from '../../../components/ClientProfileView';

export default function UsuarioScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClientProfileView userId={id} userRole="business" />;
}
