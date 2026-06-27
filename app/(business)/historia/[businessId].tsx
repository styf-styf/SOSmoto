import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StoryViewer } from '../../../components/StoryViewer';
import { getVisibleStoriesForBusinesses } from '../../../services/stories';

export default function BusinessSideBusinessStoryViewerScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const loadStories = useCallback(() => getVisibleStoriesForBusinesses([businessId]), [businessId]);
  return <StoryViewer loadStories={loadStories} homeHref="/(business)" contactBusinessId={businessId} />;
}
