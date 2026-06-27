import { supabase } from './supabase';
import type { Post, PostComment } from '../types/database';

export interface CreatePostParams {
  businessId?: string;
  clientId?: string;
  imageUrl?: string;
  caption?: string;
  tagBusinessId?: string;
  tagServiceId?: string;
  tagProductId?: string;
}

export async function createPost(params: CreatePostParams): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      business_id: params.businessId ?? null,
      client_id: params.clientId ?? null,
      image_url: params.imageUrl ?? null,
      caption: params.caption?.trim() || null,
      tag_business_id: params.tagBusinessId ?? null,
      tag_service_id: params.tagServiceId ?? null,
      tag_product_id: params.tagProductId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Post;
}

export async function deletePost(postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId);
  if (error) throw error;
}

export async function getMyBusinessPosts(businessId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Post[];
}

export async function getMyClientPosts(clientId: string): Promise<Post[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Post[];
}

const FEED_SELECT = `
  *,
  author_business:businesses!posts_business_id_fkey(id, name, logo_url),
  author_client:users!posts_client_id_fkey(id, full_name, avatar_url),
  tag_business:businesses!posts_tag_business_id_fkey(id, name),
  tag_service:services!posts_tag_service_id_fkey(id, name),
  tag_product:products!posts_tag_product_id_fkey(id, name)
`;

export interface PostWithAuthor extends Post {
  author_business: { id: string; name: string; logo_url: string | null } | null;
  author_client: { id: string; full_name: string; avatar_url: string | null } | null;
  tag_business: { id: string; name: string } | null;
  tag_service: { id: string; name: string } | null;
  tag_product: { id: string; name: string } | null;
}

// Feed público de publicaciones (de cualquier negocio o cliente) -- se usa
// igual en el home del cliente y el del negocio.
export async function getPublicFeed(limit = 20): Promise<PostWithAuthor[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(FEED_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as PostWithAuthor[];
}

export async function getPostById(postId: string): Promise<PostWithAuthor | null> {
  const { data, error } = await supabase.from('posts').select(FEED_SELECT).eq('id', postId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as unknown as PostWithAuthor | null;
}

export function getPostAuthorName(post: PostWithAuthor): string {
  return post.author_business?.name ?? post.author_client?.full_name ?? 'Usuario';
}

export function getPostAuthorAvatar(post: PostWithAuthor): string | null {
  return post.author_business?.logo_url ?? post.author_client?.avatar_url ?? null;
}

export interface PostTag {
  label: string;
  href: string;
}

// El chip de etiqueta siempre navega a una pantalla dentro de (client) --
// igual decisión que el botón de acción de Historias (StoryViewer.tsx):
// funciona igual sin importar si quien lo ve está en el home de cliente o
// de negocio.
export function getPostTag(post: PostWithAuthor): PostTag | null {
  if (post.tag_business) return { label: post.tag_business.name, href: `/(client)/business/${post.tag_business.id}` };
  if (post.tag_service) return { label: post.tag_service.name, href: `/(client)/servicio/${post.tag_service.id}` };
  if (post.tag_product) return { label: post.tag_product.name, href: `/(client)/producto/${post.tag_product.id}` };
  return null;
}

export interface PostCommentWithAuthor extends PostComment {
  users: { id: string; full_name: string; avatar_url: string | null } | null;
}

export async function getComments(postId: string): Promise<PostCommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*, users(id, full_name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as PostCommentWithAuthor[];
}

export async function createComment(postId: string, authorId: string, body: string): Promise<PostComment> {
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, author_id: authorId, body: body.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as PostComment;
}

export async function deleteComment(commentId: string): Promise<void> {
  const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
  if (error) throw error;
}
