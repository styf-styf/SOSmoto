-- has_stories quedó redundante desde que max_active_stories existe (0 = sin
-- historias, >0 = permitidas) -- confirmado por grep que ningún código real
-- la leía, solo max_active_stories se usa en enforce_story_limit.
alter table subscription_plans drop column has_stories;
