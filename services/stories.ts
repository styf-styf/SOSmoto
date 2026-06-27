import { supabase } from './supabase';
import type { Story, StoryActionType } from '../types/database';

export async function getBusinessStories(businessId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Story[];
}

export interface CreateStoryParams {
  businessId: string;
  imageUrl: string;
  caption?: string;
  actionType: StoryActionType;
  actionTargetId?: string;
  isPinned?: boolean;
}

// El trigger stories_enforce_limit (migración 0028) rechaza el insert si el
// negocio ya alcanzó el límite de su plan -- el mensaje de Postgres ya viene
// en español y listo para mostrar.
export async function createStory(params: CreateStoryParams): Promise<Story> {
  const { data, error } = await supabase
    .from('stories')
    .insert({
      business_id: params.businessId,
      image_url: params.imageUrl,
      caption: params.caption?.trim() || null,
      action_type: params.actionType,
      action_target_id: params.actionTargetId ?? null,
      is_pinned: params.isPinned ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Story;
}

export async function deleteStory(storyId: string): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) throw error;
}

// Historias visibles (activas <24h, o fijadas) para un conjunto de negocios.
// Se usa tanto para la barra de Inicio (varios negocios) como para el visor
// de un negocio puntual (un solo id).
export async function getVisibleStoriesForBusinesses(businessIds: string[]): Promise<Story[]> {
  if (businessIds.length === 0) return [];
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .in('business_id', businessIds)
    .or(`is_pinned.eq.true,created_at.gt.${dayAgoIso}`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Story[];
}

// IDs de las historias (dentro de `storyIds`) que este cliente ya vio.
export async function getSeenStoryIds(clientId: string, storyIds: string[]): Promise<Set<string>> {
  if (storyIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('story_views')
    .select('story_id')
    .eq('client_id', clientId)
    .in('story_id', storyIds);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.story_id as string));
}

export async function registerStoryView(storyId: string, clientId: string): Promise<void> {
  const { error: viewError } = await supabase
    .from('story_views')
    .upsert({ story_id: storyId, client_id: clientId }, { onConflict: 'story_id,client_id' });
  if (viewError) throw viewError;

  const { error } = await supabase.rpc('increment_story_metric', { story_id: storyId, metric: 'view' });
  if (error) throw error;
}

export async function registerStoryClick(storyId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_story_metric', { story_id: storyId, metric: 'click' });
  if (error) throw error;
}
