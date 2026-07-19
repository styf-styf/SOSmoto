import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StoryViewer } from '../../../components/StoryViewer';
import { useAuth } from '../../../hooks/useAuth';
import { deleteStory, getVisibleStoriesForClient } from '../../../services/stories';

export default function ClientClientStoryViewerScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const { profile } = useAuth();
  const loadStories = useCallback(() => getVisibleStoriesForClient(clientId), [clientId]);
  const isOwn = profile?.id === clientId;
  return (
    <StoryViewer
      loadStories={loadStories}
      homeHref="/(client)"
      canDelete={isOwn}
      onDelete={isOwn ? deleteStory : undefined}
    />
  );
}
