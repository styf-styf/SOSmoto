import { useLocalSearchParams } from 'expo-router';
import { PostDetail } from '../../../components/PostDetail';

export default function BusinessPostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PostDetail postId={id} />;
}
