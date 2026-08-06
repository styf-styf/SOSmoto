import { supabase } from './supabase';
import { getUsersByIds } from './users';
import { distanceKm as calcDistanceKm } from '../utils/distance';
import type { Story, StoryActionType } from '../types/database';

export async function getBusinessStories(businessId: string): Promise<Story[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('business_id', businessId)
    .or(`is_pinned.eq.true,created_at.gt.${cutoff}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Story[];
}

export async function getClientStories(clientId: string): Promise<Story[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('client_id', clientId)
    .gt('created_at', cutoff)
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
// El autor ya NO se resuelve con un join embebido directo a `users` (ver
// migración 0145) -- ese join dependía de una policy de RLS que daba acceso
// de FILA completa al autor de la historia, exponiendo también su email/
// teléfono a cualquier autenticado sin relación real con él. Se resuelve
// aparte vía la vista pública `public_profiles` (solo nombre/avatar).
export async function getVisibleClientStories(): Promise<ClientStoryWithAuthor[]> {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .not('client_id', 'is', null)
    .gt('created_at', dayAgoIso)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const stories = (data ?? []) as Story[];
  const clientIds = Array.from(new Set(stories.map((s) => s.client_id).filter((id): id is string => !!id)));
  const profiles = await getUsersByIds(clientIds);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  return stories.map((s) => ({ ...s, users: s.client_id ? (byId.get(s.client_id) ?? null) : null })) as ClientStoryWithAuthor[];
}

export interface BusinessStoryWithAuthor extends Story {
  businesses: {
    id: string;
    name: string;
    logo_url: string | null;
    is_verified: boolean;
    latitude: number | null;
    longitude: number | null;
    plan_id: string;
  } | null;
}

// "Pagado" = cualquier plan que no sea free (workshop o store) -- se usa
// como boost de prioridad en el orden del carrusel de historias
// (groupStoriesByAuthor), no depende del tipo de negocio.
export async function getPaidPlanIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('subscription_plans').select('id').neq('name', 'free');
  if (error) throw error;
  return new Set((data ?? []).map((p) => p.id as string));
}

// Historias activas de TODOS los negocios (no solo seguidos/cercanos) -- junto
// con getVisibleClientStories(), alimenta la fila combinada de "Estados" que
// se muestra igual en el home del cliente y en el del negocio.
export async function getVisibleBusinessStoriesGlobal(): Promise<BusinessStoryWithAuthor[]> {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*, businesses:businesses_public(id, name, logo_url, is_verified, business_type, latitude, longitude, plan_id)')
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
  isVerified: boolean;
}

interface ScoredStoryFeedItem extends StoryFeedItem {
  isPaidPlan: boolean;
  isFollowed: boolean;
  distanceKm: number;
  latestCreatedAtMs: number;
}

// Agrupa las historias de negocios y de clientes por autor (un ítem por
// negocio/cliente, no por historia individual) para la fila combinada de
// "Estados". `excludeBusinessId`/`excludeClientId` quitan al propio
// viewer -- ese se muestra aparte, como el primer espacio de la fila.
// Las listas vienen ordenadas por created_at ascendente, así que la última
// historia recorrida por autor es siempre la más reciente -- esa es la que
// se usa como miniatura de la tarjeta y como `latestCreatedAtMs`.
//
// Orden final (claves en cascada, no un score mezclado -- más fácil de
// razonar): sin ver > plan pagado > seguido > más cercano > más reciente.
// Las historias de cliente no tienen plan/seguido/distancia (quedan en el
// mismo nivel que un negocio free/no-seguido/sin ubicación conocida), así
// que dentro de ese grupo el desempate final por recencia es lo único que
// las ordena -- antes no había ningún criterio de fecha y el orden salía
// casi aleatorio.
export function groupStoriesByAuthor(params: {
  businessStories: BusinessStoryWithAuthor[];
  clientStories: ClientStoryWithAuthor[];
  seenStoryIds: Set<string>;
  excludeBusinessId?: string;
  excludeClientId?: string;
  paidPlanIds?: Set<string>;
  followedBusinessIds?: Set<string>;
  userCoords?: { latitude: number; longitude: number } | null;
}): StoryFeedItem[] {
  const items = new Map<string, ScoredStoryFeedItem>();

  for (const story of params.businessStories) {
    if (!story.businesses || story.business_id === params.excludeBusinessId) continue;
    const unseen = !params.seenStoryIds.has(story.id);
    const key = `business:${story.business_id}`;
    const biz = story.businesses;
    const distanceKm =
      params.userCoords && biz.latitude != null && biz.longitude != null
        ? calcDistanceKm(params.userCoords.latitude, params.userCoords.longitude, biz.latitude, biz.longitude)
        : Infinity;
    const isPaidPlan = params.paidPlanIds?.has(biz.plan_id) ?? false;
    const isFollowed = params.followedBusinessIds?.has(story.business_id as string) ?? false;
    const createdAtMs = new Date(story.created_at).getTime();
    const existing = items.get(key);
    if (existing) {
      existing.hasUnseen = existing.hasUnseen || unseen;
      existing.previewImageUrl = story.image_url;
      existing.latestCreatedAtMs = createdAtMs;
    } else {
      items.set(key, {
        id: story.business_id as string,
        kind: 'business',
        name: biz.name,
        avatarUrl: biz.logo_url,
        previewImageUrl: story.image_url,
        hasUnseen: unseen,
        isVerified: biz.is_verified,
        isPaidPlan,
        isFollowed,
        distanceKm,
        latestCreatedAtMs: createdAtMs,
      });
    }
  }

  for (const story of params.clientStories) {
    if (!story.users || story.client_id === params.excludeClientId) continue;
    const unseen = !params.seenStoryIds.has(story.id);
    const key = `client:${story.client_id}`;
    const createdAtMs = new Date(story.created_at).getTime();
    const existing = items.get(key);
    if (existing) {
      existing.hasUnseen = existing.hasUnseen || unseen;
      existing.previewImageUrl = story.image_url;
      existing.latestCreatedAtMs = createdAtMs;
    } else {
      items.set(key, {
        id: story.client_id as string,
        kind: 'client',
        name: story.users.full_name,
        avatarUrl: story.users.avatar_url,
        previewImageUrl: story.image_url,
        hasUnseen: unseen,
        isVerified: false,
        isPaidPlan: false,
        isFollowed: false,
        distanceKm: Infinity,
        latestCreatedAtMs: createdAtMs,
      });
    }
  }

  return Array.from(items.values())
    .sort((a, b) => {
      if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
      if (a.isPaidPlan !== b.isPaidPlan) return a.isPaidPlan ? -1 : 1;
      if (a.isFollowed !== b.isFollowed) return a.isFollowed ? -1 : 1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return b.latestCreatedAtMs - a.latestCreatedAtMs;
    })
    .map(({ isPaidPlan, isFollowed, distanceKm, latestCreatedAtMs, ...rest }) => rest);
}

// Historias activas de los negocios que sigue un cliente específico.
// Equivale a getVisibleBusinessStoriesGlobal pero filtrado por follows.
export async function getVisibleBusinessStoriesFollowed(
  clientId: string,
  followerBusinessId?: string | null
): Promise<BusinessStoryWithAuthor[]> {
  let followsQuery = supabase.from('follows').select('business_id');
  followsQuery = followerBusinessId
    ? followsQuery.eq('follower_business_id', followerBusinessId)
    : followsQuery.eq('client_id', clientId).is('follower_business_id', null);
  const { data: followsData, error: followsError } = await followsQuery;
  if (followsError) throw followsError;
  const businessIds = (followsData ?? []).map((f) => f.business_id as string);
  if (businessIds.length === 0) return [];
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('*, businesses:businesses_public(id, name, logo_url, is_verified, latitude, longitude, plan_id)')
    .in('business_id', businessIds)
    .or(`is_pinned.eq.true,created_at.gt.${dayAgoIso}`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as BusinessStoryWithAuthor[];
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
