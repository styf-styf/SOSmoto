import { createAdminClient } from '../../../lib/supabase/admin';
import type { AdminPostRow, AdminProductRow, AdminReviewRow, AdminServiceRow, AdminStoryRow } from '../../../lib/types';
import { Paginator } from '../../../components/Paginator';
import { PostDeleteButton } from './PostDeleteButton';
import { ProductDeleteButton } from './ProductDeleteButton';
import { ReviewDeleteButton } from './ReviewDeleteButton';
import { ServiceDeleteButton } from './ServiceDeleteButton';
import { StoryDeleteButton } from './StoryDeleteButton';

const PAGE_SIZE = 12;

type Tab = 'stories' | 'posts' | 'products' | 'services' | 'reviews';
const TABS: { value: Tab; label: string }[] = [
  { value: 'stories', label: 'Historias' },
  { value: 'posts', label: 'Publicaciones' },
  { value: 'products', label: 'Productos' },
  { value: 'services', label: 'Servicios' },
  { value: 'reviews', label: 'Reseñas' },
];

function stars(rating: number) {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export default async function ModeracionPage({
  searchParams,
}: {
  searchParams: { tab?: string; page?: string };
}) {
  const tab: Tab = (TABS.find((t) => t.value === searchParams.tab)?.value ?? 'stories');
  const page = Math.max(1, Number(searchParams.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = createAdminClient();

  return (
    <div>
      <h1 className="mb-2 text-xl font-bold">Moderación</h1>
      <p className="mb-4 text-sm text-gray-500">
        Contenido generado por clientes y negocios. Elimina cualquiera que sea inapropiado o viole las políticas.
      </p>

      <div className="mb-6 flex gap-4 border-b border-gray-200">
        {TABS.map((t) => (
          <a
            key={t.value}
            href={`?tab=${t.value}`}
            className={
              tab === t.value
                ? 'border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary'
                : 'px-1 pb-2 text-sm font-medium text-gray-500'
            }
          >
            {t.label}
          </a>
        ))}
      </div>

      {tab === 'stories' && <StoriesTab supabase={supabase} from={from} to={to} page={page} />}
      {tab === 'posts' && <PostsTab supabase={supabase} from={from} to={to} page={page} />}
      {tab === 'products' && <ProductsTab supabase={supabase} from={from} to={to} page={page} />}
      {tab === 'services' && <ServicesTab supabase={supabase} from={from} to={to} page={page} />}
      {tab === 'reviews' && <ReviewsTab supabase={supabase} from={from} to={to} page={page} />}
    </div>
  );
}

async function StoriesTab({ supabase, from, to, page }: { supabase: any; from: number; to: number; page: number }) {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, count, error } = await supabase
    .from('stories')
    .select(
      'id, business_id, client_id, image_url, caption, is_pinned, views, clicks, created_at, businesses(name), users!stories_client_id_fkey(full_name)',
      { count: 'exact' }
    )
    .or(`is_pinned.eq.true,created_at.gt.${dayAgoIso}`)
    .order('created_at', { ascending: false })
    .range(from, to);

  const stories = (data ?? []) as unknown as AdminStoryRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Las historias se publican sin aprobación previa (contenido orgánico de 24h).
      </p>
      {error && <p className="text-sm text-red-600">Error cargando historias: {error.message}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {stories.map((story) => (
          <div key={story.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            <img src={story.image_url} alt="" className="h-48 w-full object-cover" />
            <div className="p-3">
              <p className="text-sm font-semibold">
                {story.businesses?.name ?? story.users?.full_name ?? 'Usuario'}
                {story.client_id ? ' (cliente)' : ''}
              </p>
              {story.caption && <p className="mt-1 text-sm text-gray-600">{story.caption}</p>}
              <p className="mt-1 text-xs text-gray-400">
                {story.is_pinned ? 'Destacada · ' : ''}
                {story.views} vistas · {story.clicks} clics
              </p>
              <StoryDeleteButton storyId={story.id} />
            </div>
          </div>
        ))}
        {stories.length === 0 && !error && <p className="text-sm text-gray-500">No hay historias activas.</p>}
      </div>
      <Paginator page={page} totalPages={totalPages} buildHref={(p) => `?tab=stories&page=${p}`} />
    </div>
  );
}

async function PostsTab({ supabase, from, to, page }: { supabase: any; from: number; to: number; page: number }) {
  const { data, count, error } = await supabase
    .from('posts')
    .select(
      'id, business_id, client_id, photos, caption, comments_count, created_at, businesses!posts_business_id_fkey(name), users!posts_client_id_fkey(full_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  const posts = (data ?? []) as unknown as AdminPostRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">Contenido permanente subido por clientes y negocios.</p>
      {error && <p className="text-sm text-red-600">Error cargando publicaciones: {error.message}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {posts.map((post) => (
          <div key={post.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            {post.photos[0] ? (
              <img src={post.photos[0]} alt="" className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                Sin imagen
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-semibold">
                {post.businesses?.name ?? post.users?.full_name ?? 'Usuario'}
                {post.client_id ? ' (cliente)' : ''}
              </p>
              {post.caption && <p className="mt-1 text-sm text-gray-600">{post.caption}</p>}
              <p className="mt-1 text-xs text-gray-400">{post.comments_count} comentario(s)</p>
              <PostDeleteButton postId={post.id} />
            </div>
          </div>
        ))}
        {posts.length === 0 && !error && <p className="text-sm text-gray-500">No hay publicaciones.</p>}
      </div>
      <Paginator page={page} totalPages={totalPages} buildHref={(p) => `?tab=posts&page=${p}`} />
    </div>
  );
}

async function ProductsTab({ supabase, from, to, page }: { supabase: any; from: number; to: number; page: number }) {
  const { data, count, error } = await supabase
    .from('products')
    .select('id, business_id, name, description, reference_price, stock, photos, is_active, created_at, businesses(name)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  const products = (data ?? []) as unknown as AdminProductRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">Catálogo de productos de todos los negocios.</p>
      {error && <p className="text-sm text-red-600">Error cargando productos: {error.message}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {products.map((product) => (
          <div key={product.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            {product.photos[0] ? (
              <img src={product.photos[0]} alt="" className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                Sin imagen
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-semibold">
                {product.name}
                {!product.is_active && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                    Inactivo
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-400">{product.businesses?.name ?? 'Negocio'}</p>
              {product.description && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{product.description}</p>}
              <p className="mt-1 text-xs text-gray-400">
                {product.reference_price !== null ? `$${Number(product.reference_price).toFixed(2)}` : 'Sin precio'} · Stock:{' '}
                {product.stock}
              </p>
              <ProductDeleteButton productId={product.id} />
            </div>
          </div>
        ))}
        {products.length === 0 && !error && <p className="text-sm text-gray-500">No hay productos.</p>}
      </div>
      <Paginator page={page} totalPages={totalPages} buildHref={(p) => `?tab=products&page=${p}`} />
    </div>
  );
}

async function ServicesTab({ supabase, from, to, page }: { supabase: any; from: number; to: number; page: number }) {
  const { data, count, error } = await supabase
    .from('services')
    .select('id, business_id, name, description, reference_price, photos, is_active, created_at, businesses(name)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  const services = (data ?? []) as unknown as AdminServiceRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">Catálogo de servicios de todos los talleres.</p>
      {error && <p className="text-sm text-red-600">Error cargando servicios: {error.message}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
        {services.map((service) => (
          <div key={service.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
            {service.photos[0] ? (
              <img src={service.photos[0]} alt="" className="h-48 w-full object-cover" />
            ) : (
              <div className="flex h-48 w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
                Sin imagen
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-semibold">
                {service.name}
                {!service.is_active && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                    Inactivo
                  </span>
                )}
              </p>
              <p className="mt-1 text-xs text-gray-400">{service.businesses?.name ?? 'Negocio'}</p>
              {service.description && <p className="mt-1 text-sm text-gray-600 line-clamp-2">{service.description}</p>}
              <p className="mt-1 text-xs text-gray-400">
                {service.reference_price !== null ? `$${Number(service.reference_price).toFixed(2)}` : 'Sin precio'}
              </p>
              <ServiceDeleteButton serviceId={service.id} />
            </div>
          </div>
        ))}
        {services.length === 0 && !error && <p className="text-sm text-gray-500">No hay servicios.</p>}
      </div>
      <Paginator page={page} totalPages={totalPages} buildHref={(p) => `?tab=services&page=${p}`} />
    </div>
  );
}

async function ReviewsTab({ supabase, from, to, page }: { supabase: any; from: number; to: number; page: number }) {
  const { data, count, error } = await supabase
    .from('reviews')
    .select(
      'id, reviewer_id, reviewed_business_id, reviewed_client_id, rating, comment, is_public, created_at, reviewer:users!reviews_reviewer_id_fkey(full_name), reviewed_business:businesses!reviews_reviewed_business_id_fkey(name), reviewed_client:users!reviews_reviewed_client_id_fkey(full_name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);

  const reviews = (data ?? []) as unknown as AdminReviewRow[];
  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Calificaciones de clientes a negocios (públicas) y de negocios a clientes (internas, auxilio en carretera).
      </p>
      {error && <p className="text-sm text-red-600">Error cargando reseñas: {error.message}</p>}

      <table className="mb-4 w-full border-collapse overflow-hidden rounded-xl bg-white text-sm shadow-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-gray-500">
            <th className="px-4 py-3">Autor</th>
            <th className="px-4 py-3">Sobre</th>
            <th className="px-4 py-3">Calificación</th>
            <th className="px-4 py-3">Comentario</th>
            <th className="px-4 py-3">Visibilidad</th>
            <th className="px-4 py-3">Fecha</th>
            <th className="px-4 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {reviews.map((review) => (
            <tr key={review.id} className="border-b border-gray-100">
              <td className="px-4 py-3 font-medium">{review.reviewer?.full_name ?? '—'}</td>
              <td className="px-4 py-3">{review.reviewed_business?.name ?? review.reviewed_client?.full_name ?? '—'}</td>
              <td className="px-4 py-3 text-amber-500">{stars(review.rating)}</td>
              <td className="px-4 py-3 max-w-[240px] text-gray-600">{review.comment ?? '—'}</td>
              <td className="px-4 py-3">
                {review.is_public ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Pública</span>
                ) : (
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">Interna</span>
                )}
              </td>
              <td className="px-4 py-3">{new Date(review.created_at).toLocaleDateString('es-EC')}</td>
              <td className="px-4 py-3">
                <ReviewDeleteButton reviewId={review.id} />
              </td>
            </tr>
          ))}
          {reviews.length === 0 && !error && (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                No hay reseñas todavía.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <Paginator page={page} totalPages={totalPages} buildHref={(p) => `?tab=reviews&page=${p}`} />
    </div>
  );
}
