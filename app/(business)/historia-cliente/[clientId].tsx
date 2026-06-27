import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StoryViewer } from '../../../components/StoryViewer';
import { getVisibleStoriesForClient } from '../../../services/stories';

export default function BusinessSideClientStoryViewerScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const loadStories = useCallback(() => getVisibleStoriesForClient(clientId), [clientId]);
  return <StoryViewer loadStories={loadStories} homeHref="/(business)" />;
}
