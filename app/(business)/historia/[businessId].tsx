import { useCallback, useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { StoryViewer } from '../../../components/StoryViewer';
import { useAuth } from '../../../hooks/useAuth';
import { getMyWorkBusiness } from '../../../services/businesses';
import { deleteStory, getVisibleStoriesForBusinesses } from '../../../services/stories';

export default function BusinessSideBusinessStoryViewerScreen() {
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { profile } = useAuth();
  const [isOwn, setIsOwn] = useState(false);
  const loadStories = useCallback(() => getVisibleStoriesForBusinesses([businessId]), [businessId]);

  useEffect(() => {
    if (!profile) return;
    getMyWorkBusiness(profile.id)
      .then((work) => setIsOwn(work?.business?.id === businessId))
      .catch((err) => console.error('load own business error', err));
  }, [profile, businessId]);

  return (
    <StoryViewer
      loadStories={loadStories}
      homeHref="/(business)"
      contactBusinessId={businessId}
      canDelete={isOwn}
      onDelete={isOwn ? deleteStory : undefined}
    />
  );
}
