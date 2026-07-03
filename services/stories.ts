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

export async function getClientStories(clientId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Story[];
}

// Activa = visible para los demás ahora mismo (fijada, o subida hace <24h).
// Los clientes nunca pueden fijar, así que para ellos es solo la ventana de 24h.
export function isStoryVisible(story: Story): boolean {
  if (story.is_pinned) return true;
  return Date.now() - new Date(story.created_at).getTime() < 24 * 60 * 60 * 1000;
}

export interface CreateStoryParams {
  businessId?: string;
  clientId?: string;
  imageUrl: string;
  caption?: string;
  actionType: StoryActionType;
  actionTargetId?: string;
  isPinned?: boolean;
}

// El trigger stories_enforce_limit (migraciones 0028/0030) rechaza el insert
// si el negocio alcanzó el límite de su plan, o si el cliente ya subió 3
// historias hoy -- el mensaje de Postgres ya viene en español y listo para mostrar.
export async function createStory(params: CreateStoryParams): Promise<Story> {
  const { data, error } = await supabase
    .from('stories')
    .insert({
      business_id: params.businessId ?? null,
      client_id: params.clientId ?? null,
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

// Historias visibles (<24h, sin pin para clientes) de un cliente puntual --
// usado por el visor full-screen de la historia de un cliente.
export async function getVisibleStoriesForClient(clientId: string): Promise<Story[]> {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('client_id', clientId)
    .gt('created_at', dayAgoIso)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Story[];
}

export interface ClientStoryWithAuthor extends Story {
  users: { id: string; full_name: string; avatar_url: string | null } | null;
}

// Feed público de historias de TODOS los clientes (<24h) para la sección
// "Comunidad" del Inicio -- a diferencia de las de negocio, no depende de
// seguidos/cercanía.
export async function getVisibleClientStories(): Promise<ClientStoryWithAuthor[]> {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*, users!stories_client_id_fkey(id, full_name, avatar_url)')
    .not('client_id', 'is', null)
    .gt('created_at', dayAgoIso)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ClientStoryWithAuthor[];
}

export interface BusinessStoryWithAuthor extends Story {
  businesses: { id: string; name: string; logo_url: string | null } | null;
}

// Historias activas de TODOS los negocios (no solo seguidos/cercanos) -- junto
// con getVisibleClientStories(), alimenta la fila combinada de "Estados" que
// se muestra igual en el home del cliente y en el del negocio.
export async function getVisibleBusinessStoriesGlobal(): Promise<BusinessStoryWithAuthor[]> {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*, businesses(id, name, logo_url)')
    .not('business_id', 'is', null)
    .or(`is_pinned.eq.true,created_at.gt.${dayAgoIso}`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as BusinessStoryWithAuthor[];
}

export interface StoryFeedItem {
  id: string;
  kind: 'business' | 'client';
  name: string;
  avatarUrl: string | null;
  previewImageUrl: string;
  hasUnseen: boolean;
}

// Agrupa las historias de negocios y de clientes por autor (un ítem por
// negocio/cliente, no por historia individual) para la fila combinada de
// "Estados". `excludeBusinessId`/`excludeClientId` quitan al propio
// viewer -- ese se muestra aparte, como el primer espacio de la fila.
// Las listas vienen ordenadas por created_at ascendente, así que la última
// historia recorrida por autor es siempre la más reciente -- esa es la que
// se usa como miniatura de la tarjeta.
export function groupStoriesByAuthor(params: {
  businessStories: BusinessStoryWithAuthor[];
  clientStories: ClientStoryWithAuthor[];
  seenStoryIds: Set<string>;
  excludeBusinessId?: string;
  excludeClientId?: string;
}): StoryFeedItem[] {
  const items = new Map<string, StoryFeedItem>();

  for (const story of params.businessStories) {
    if (!story.businesses || story.business_id === params.excludeBusinessId) continue;
    const unseen = !params.seenStoryIds.has(story.id);
    const key = `business:${story.business_id}`;
    const existing = items.get(key);
    if (existing) {
      existing.hasUnseen = existing.hasUnseen || unseen;
      existing.previewImageUrl = story.image_url;
    } else {
      items.set(key, {
        id: story.business_id as string,
        kind: 'business',
        name: story.businesses.name,
        avatarUrl: story.businesses.logo_url,
        previewImageUrl: story.image_url,
        hasUnseen: unseen,
      });
    }
  }

  for (const story of params.clientStories) {
    if (!story.users || story.client_id === params.excludeClientId) continue;
    const unseen = !params.seenStoryIds.has(story.id);
    const key = `client:${story.client_id}`;
    const existing = items.get(key);
    if (existing) {
      existing.hasUnseen = existing.hasUnseen || unseen;
      existing.previewImageUrl = story.image_url;
    } else {
      items.set(key, {
        id: story.client_id as string,
        kind: 'client',
        name: story.users.full_name,
        avatarUrl: story.users.avatar_url,
        previewImageUrl: story.image_url,
        hasUnseen: unseen,
      });
    }
  }

  return Array.from(items.values()).sort((a, b) => Number(b.hasUnseen) - Number(a.hasUnseen));
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

export async function getClientActiveStoryCount(clientId: string): Promise<number> {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('stories')
    .select('*', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gt('created_at', dayAgoIso);
  if (error) throw error;
  return count ?? 0;
}

export async function registerStoryView(storyId: string, clientId: string): Promise<void> {
  const { error: viewError } = await supabase
    .from('story_views')
    .upsert({ story_id: storyId, client_id: clientId }, { onConflict: 'story_id,client_id', ignoreDuplicates: true });
  if (viewError) throw viewError;

  const { error } = await supabase.rpc('increment_story_metric', { story_id: storyId, metric: 'view' });
  if (error) throw error;
}

export async function registerStoryClick(storyId: string): Promise<void> {
  const { error } = await supabase.rpc('increment_story_metric', { story_id: storyId, metric: 'click' });
  if (error) throw error;
}
