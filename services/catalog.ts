import { supabase } from './supabase';
import type { BusinessType, Category, CategoryKind, Product, ProductPriceTier, ProductVariant, Service } from '../types/database';

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data, error } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductVariant[];
}

export interface CreateProductVariantParams {
  productId: string;
  label: string;
  stock: number;
  referencePrice: number | null;
  priceTiers?: ProductPriceTier[] | null;
}

export async function createProductVariant(params: CreateProductVariantParams): Promise<ProductVariant> {
  const { data, error } = await supabase
    .from('product_variants')
    .insert({
      product_id: params.productId,
      label: params.label,
      stock: params.stock,
      reference_price: params.referencePrice,
      price_tiers: params.priceTiers ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProductVariant;
}

export async function updateProductVariant(
  id: string,
  updates: Partial<{ label: string; stock: number; reference_price: number | null; price_tiers: ProductPriceTier[] | null }>
): Promise<ProductVariant> {
  const { data, error } = await supabase.from('product_variants').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as ProductVariant;
}

export async function deleteProductVariant(id: string): Promise<void> {
  const { error } = await supabase.from('product_variants').delete().eq('id', id);
  if (error) throw error;
}

// Mantiene products.stock como la suma de sus variantes activas -- así el
// resto de la app (búsqueda, feed, inventario, badges de "sin stock") sigue
// leyendo un solo número sin tener que enterarse de que existen variantes.
export async function syncProductStockFromVariants(productId: string): Promise<void> {
  const variants = await getProductVariants(productId);
  const total = variants.reduce((sum, v) => sum + v.stock, 0);
  const { error } = await supabase.from('products').update({ stock: total }).eq('id', productId);
  if (error) throw error;
}

export async function getCategories(kind: CategoryKind): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('kind', kind)
    .order('name');
  if (error) throw error;
  return (data ?? []) as Category[];
}

export async function suggestCategory(name: string, kind: CategoryKind): Promise<Category> {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: name.trim(), kind, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data as Category;
}

export async function getActiveServices(businessId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function getActiveProducts(businessId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function getAllServices(businessId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Service[];
}

export async function getAllProducts(businessId: string): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as Product[];
}

export interface ServiceWithBusiness extends Service {
  business_name: string;
  business_owner_id: string;
  business_logo_url: string | null;
  business_is_verified: boolean;
  category_name: string;
}

export interface ProductWithBusiness extends Product {
  business_name: string;
  business_owner_id: string;
  business_logo_url: string | null;
  business_is_verified: boolean;
  business_type: BusinessType;
  category_name: string;
  variants: ProductVariant[];
}

// Todos los escalones de precio de un producto, incluyendo el "escalon 0"
// implicito (min_order_quantity/referencePrice) -- price_tiers en la BD solo
// guarda los escalones ADICIONALES, esta funcion arma la lista completa
// ordenada para mostrar/calcular.
export function getAllPriceTiers(
  referencePrice: number | null,
  minOrderQuantity: number | null,
  extraTiers: ProductPriceTier[] | null
): ProductPriceTier[] {
  if (referencePrice === null) return extraTiers ?? [];
  const base: ProductPriceTier = { min_quantity: minOrderQuantity ?? 1, unit_price: referencePrice };
  return [base, ...(extraTiers ?? [])].sort((a, b) => a.min_quantity - b.min_quantity);
}

// Precio por unidad que corresponde a una cantidad pedida: el escalon con el
// min_quantity mas alto que sea <= quantity. Si no hay escalones o la
// cantidad no alcanza ninguno, cae al precio base.
export function getEffectiveUnitPrice(
  referencePrice: number | null,
  minOrderQuantity: number | null,
  extraTiers: ProductPriceTier[] | null,
  quantity: number
): number | null {
  const tiers = getAllPriceTiers(referencePrice, minOrderQuantity, extraTiers);
  if (tiers.length === 0) return referencePrice;
  const applicable = tiers.filter((t) => quantity >= t.min_quantity);
  return (applicable.length > 0 ? applicable[applicable.length - 1] : tiers[0]).unit_price;
}

export async function incrementProductViews(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_catalog_views', { item_id: id, item_type: 'product' });
  if (error) throw error;
}

export async function incrementServiceViews(id: string): Promise<void> {
  const { error } = await supabase.rpc('increment_catalog_views', { item_id: id, item_type: 'service' });
  if (error) throw error;
}

export async function getServiceById(id: string): Promise<ServiceWithBusiness | null> {
  const { data, error } = await supabase.from('services').select('*, businesses(name, owner_id, logo_url, is_verified), categories(name)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { businesses, categories, ...service } = data as any;
  return {
    ...service,
    business_name: businesses?.name ?? '',
    business_owner_id: businesses?.owner_id ?? '',
    business_logo_url: businesses?.logo_url ?? null,
    business_is_verified: businesses?.is_verified ?? false,
    category_name: categories?.name ?? '',
  } as ServiceWithBusiness;
}

export async function getProductById(id: string): Promise<ProductWithBusiness | null> {
  const [{ data, error }, variants] = await Promise.all([
    supabase
      .from('products')
      .select('*, businesses(name, owner_id, logo_url, is_verified, business_type), categories(name)')
      .eq('id', id)
      .maybeSingle(),
    getProductVariants(id),
  ]);
  if (error) throw error;
  if (!data) return null;
  const { businesses, categories, ...product } = data as any;
  return {
    ...product,
    business_name: businesses?.name ?? '',
    business_owner_id: businesses?.owner_id ?? '',
    business_logo_url: businesses?.logo_url ?? null,
    business_is_verified: businesses?.is_verified ?? false,
    business_type: businesses?.business_type ?? 'workshop',
    category_name: categories?.name ?? '',
    variants,
  } as ProductWithBusiness;
}

// Productos/servicios de otras tiendas en la misma categoría -- para el
// carrusel "También te puede interesar" en producto/[id].tsx y servicio/[id].tsx.
export async function getProductsByCategory(categoryId: string, excludeId: string, limit = 20): Promise<FeedCatalogItem[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, businesses(name, logo_url)')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    kind: 'product',
    id: row.id,
    businessId: row.business_id,
    businessName: row.businesses?.name ?? '',
    businessLogoUrl: row.businesses?.logo_url ?? undefined,
    name: row.name,
    referencePrice: row.reference_price,
    meta: `Stock: ${row.stock}`,
    photoUrl: row.photos?.[0],
    createdAt: row.created_at,
  }));
}

export async function getServicesByCategory(categoryId: string, excludeId: string, limit = 20): Promise<FeedCatalogItem[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*, businesses(name, logo_url)')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .neq('id', excludeId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    kind: 'service',
    id: row.id,
    businessId: row.business_id,
    businessName: row.businesses?.name ?? '',
    businessLogoUrl: row.businesses?.logo_url ?? undefined,
    name: row.name,
    referencePrice: row.reference_price,
    photoUrl: row.photos?.[0],
    createdAt: row.created_at,
  }));
}

export interface FeedCatalogItem {
  kind: 'service' | 'product';
  id: string;
  businessId: string;
  businessName: string;
  businessLogoUrl?: string;
  name: string;
  referencePrice: number | null;
  meta?: string;
  photoUrl?: string;
  createdAt: string;
  // Presente cuando esta tarjeta en realidad es un anuncio (ver
  // services/ads.ts getActiveAdsCatalogItems/searchActiveAds) mezclado entre
  // productos/servicios reales -- FeedCatalogStrip usa esto para mostrar el
  // chip "Anuncio", llevar al detalle del anuncio en vez del producto/
  // servicio, y registrar impresión/clic en vez de vistas de catálogo.
  isAd?: boolean;
  adId?: string;
}

// Muestra global de catálogo (no filtrada por seguidos/cercanía) para
// intercalar tiras de servicios/productos sueltos dentro del feed de
// Inicio -- no es un feed propio (sin comentarios/compartir), es más bien un
// banner de descubrimiento mezclado entre negocios. Devuelve ordenado por más
// reciente primero -- el propio HomeFeed decide si lo muestra en ese orden
// (primera carga) o mezclado (recargas sin nada nuevo).
export async function getFeedCatalogPool(limit = 30, opts: { excludeBrand?: boolean } = {}): Promise<FeedCatalogItem[]> {
  const [servicesResult, productsResult] = await Promise.all([
    supabase
      .from('services')
      .select('*, businesses(name, logo_url, business_type)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('products')
      .select('*, businesses(name, logo_url, business_type)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);
  if (servicesResult.error) throw servicesResult.error;
  if (productsResult.error) throw productsResult.error;

  // Filtrado en el cliente (ver comentario en searchCatalog): Supabase JS no
  // filtra bien columnas de una relación embebida sin !inner. Un cliente
  // nunca debe ver productos/servicios de una Marca (B2B puro) en su feed.
  const servicesRows = opts.excludeBrand
    ? (servicesResult.data ?? []).filter((row: any) => row.businesses?.business_type !== 'brand_advertiser')
    : (servicesResult.data ?? []);
  const productsRows = opts.excludeBrand
    ? (productsResult.data ?? []).filter((row: any) => row.businesses?.business_type !== 'brand_advertiser')
    : (productsResult.data ?? []);

  const services: FeedCatalogItem[] = servicesRows.map((row: any) => ({
    kind: 'service',
    id: row.id,
    businessId: row.business_id,
    businessName: row.businesses?.name ?? '',
    businessLogoUrl: row.businesses?.logo_url ?? undefined,
    name: row.name,
    referencePrice: row.reference_price,
    photoUrl: row.photos?.[0],
    createdAt: row.created_at,
  }));
  const products: FeedCatalogItem[] = productsRows.map((row: any) => ({
    kind: 'product',
    id: row.id,
    businessId: row.business_id,
    businessName: row.businesses?.name ?? '',
    businessLogoUrl: row.businesses?.logo_url ?? undefined,
    name: row.name,
    referencePrice: row.reference_price,
    meta: `Stock: ${row.stock}`,
    photoUrl: row.photos?.[0],
    createdAt: row.created_at,
  }));

  const merged = [...services, ...products].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return merged.slice(0, limit);
}

export interface SearchCatalogParams {
  query: string;
  // Por default busca productos y servicios -- el buscador del taller solo
  // pide 'product' (no tiene sentido buscar "servicios" de una tienda).
  kinds?: ('product' | 'service')[];
  // Filtra por el tipo de negocio dueño del producto/servicio (ej. el
  // buscador del taller solo quiere resultados de tiendas/marcas, nunca de
  // otro taller). Se filtra en el cliente porque Supabase JS no filtra bien
  // por columnas de una relación embebida sin usar !inner.
  businessTypeIn?: BusinessType[];
  limit?: number;
}

// Búsqueda por texto de productos/servicios a través de TODOS los negocios
// -- a diferencia de getProductsByCategory/getServicesByCategory (que
// buscan por categoría) o getFeedCatalogPool (muestra global sin filtro),
// esta es la que alimenta el buscador de cliente/negocio.
export async function searchCatalog(params: SearchCatalogParams): Promise<FeedCatalogItem[]> {
  const term = params.query.trim();
  if (!term) return [];
  const kinds = params.kinds ?? ['product', 'service'];
  const limit = params.limit ?? 30;

  function matchesType(businessType?: BusinessType): boolean {
    return !params.businessTypeIn?.length || (!!businessType && params.businessTypeIn.includes(businessType));
  }

  const [productsResult, servicesResult] = await Promise.all([
    kinds.includes('product')
      ? supabase
          .from('products')
          .select('*, businesses(name, logo_url, business_type)')
          .eq('is_active', true)
          .ilike('name', `%${term}%`)
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as any[], error: null }),
    kinds.includes('service')
      ? supabase
          .from('services')
          .select('*, businesses(name, logo_url, business_type)')
          .eq('is_active', true)
          .ilike('name', `%${term}%`)
          .order('created_at', { ascending: false })
          .limit(limit)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);
  if (productsResult.error) throw productsResult.error;
  if (servicesResult.error) throw servicesResult.error;

  const products: FeedCatalogItem[] = (productsResult.data ?? [])
    .filter((row: any) => matchesType(row.businesses?.business_type))
    .map((row: any) => ({
      kind: 'product',
      id: row.id,
      businessId: row.business_id,
      businessName: row.businesses?.name ?? '',
      businessLogoUrl: row.businesses?.logo_url ?? undefined,
      name: row.name,
      referencePrice: row.reference_price,
      meta: `Stock: ${row.stock}`,
      photoUrl: row.photos?.[0],
      createdAt: row.created_at,
    }));

  const services: FeedCatalogItem[] = (servicesResult.data ?? [])
    .filter((row: any) => matchesType(row.businesses?.business_type))
    .map((row: any) => ({
      kind: 'service',
      id: row.id,
      businessId: row.business_id,
      businessName: row.businesses?.name ?? '',
      businessLogoUrl: row.businesses?.logo_url ?? undefined,
      name: row.name,
      referencePrice: row.reference_price,
      photoUrl: row.photos?.[0],
      createdAt: row.created_at,
    }));

  return [...products, ...services].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export interface PlanLimits {
  planName: string;
  maxServices: number | null;
  maxProducts: number | null;
  maxEmployees: number | null;
  maxActiveStories: number | null;
  maxPhotosPerItem: number | null;
  businessType: BusinessType | null;
}

const FREE_PLAN_LIMITS: PlanLimits = {
  planName: 'free',
  maxServices: 3,
  maxProducts: 5,
  maxEmployees: 1,
  maxActiveStories: null,
  maxPhotosPerItem: 1,
  businessType: null,
};

export async function getPlanLimits(businessId: string): Promise<PlanLimits> {
  const { data, error } = await supabase
    .from('businesses')
    .select(
      'business_type, subscription_plans(name, max_services, max_products, max_employees, max_active_stories, max_photos_per_item)'
    )
    .eq('id', businessId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return FREE_PLAN_LIMITS;

  const plan = (data as any)?.subscription_plans;
  const businessType = (data as any)?.business_type ?? null;
  if (!plan) return { ...FREE_PLAN_LIMITS, businessType };
  return {
    planName: plan.name ?? 'free',
    maxServices: plan.max_services ?? null,
    // Una marca vende al por mayor a talleres/tiendas, no al consumidor
    // final -- su catalogo real suele tener muchos mas SKUs que un taller/
    // tienda de barrio, asi que el limite de plan no le aplica.
    maxProducts: businessType === 'brand_advertiser' ? null : (plan.max_products ?? null),
    maxEmployees: plan.max_employees ?? null,
    maxActiveStories: plan.max_active_stories ?? null,
    maxPhotosPerItem: plan.max_photos_per_item ?? null,
    businessType,
  };
}

function assertPhotoLimit(photos: string[] | undefined, limits: PlanLimits) {
  if (!photos || limits.maxPhotosPerItem === null) return;
  if (photos.length > limits.maxPhotosPerItem) {
    throw new Error(
      `Tu plan ${limits.planName} permite hasta ${limits.maxPhotosPerItem} foto${limits.maxPhotosPerItem === 1 ? '' : 's'} por producto/servicio. Sube de plan para agregar más.`
    );
  }
}

export interface CreateServiceParams {
  businessId: string;
  name: string;
  description?: string;
  categoryId: string;
  referencePrice?: number;
  photos?: string[];
}

export async function createService(params: CreateServiceParams): Promise<Service> {
  const limits = await getPlanLimits(params.businessId);
  if (limits.maxServices !== null) {
    const current = await getAllServices(params.businessId);
    const activeCount = current.filter((s) => s.is_active).length;
    if (activeCount >= limits.maxServices) {
      throw new Error(
        `Tu plan ${limits.planName} permite hasta ${limits.maxServices} servicios activos. Sube de plan para agregar más.`
      );
    }
  }
  assertPhotoLimit(params.photos, limits);

  const { data, error } = await supabase
    .from('services')
    .insert({
      business_id: params.businessId,
      name: params.name,
      description: params.description ?? null,
      category_id: params.categoryId,
      reference_price: params.referencePrice ?? null,
      photos: params.photos ?? [],
    })
    .select()
    .single();
  if (error) throw error;
  return data as Service;
}

export async function updateService(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    category_id: string;
    reference_price: number | null;
    is_active: boolean;
    photos: string[];
  }>
): Promise<Service> {
  if (updates.photos) {
    const { data: current } = await supabase.from('services').select('business_id').eq('id', id).maybeSingle();
    if (current) assertPhotoLimit(updates.photos, await getPlanLimits(current.business_id));
  }

  const { data, error } = await supabase.from('services').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Service;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.from('services').delete().eq('id', id);
  if (error) throw error;
}

export interface CreateProductParams {
  businessId: string;
  name: string;
  description?: string;
  categoryId: string;
  referencePrice?: number;
  stock?: number;
  photos?: string[];
  // Cantidad minima de pedido -- para venta al por mayor (marca -> taller/tienda).
  minOrderQuantity?: number;
  // Escalones adicionales de precio por volumen (ver ProductPriceTier) --
  // el primer escalon (min_order_quantity/referencePrice) no va aca, se arma
  // solo al leer el producto (ver effectivePriceTiers).
  priceTiers?: ProductPriceTier[] | null;
}

export async function createProduct(params: CreateProductParams): Promise<Product> {
  const limits = await getPlanLimits(params.businessId);
  if (limits.maxProducts !== null) {
    const current = await getAllProducts(params.businessId);
    const activeCount = current.filter((p) => p.is_active).length;
    if (activeCount >= limits.maxProducts) {
      throw new Error(
        `Tu plan ${limits.planName} permite hasta ${limits.maxProducts} productos activos. Sube de plan para agregar más.`
      );
    }
  }
  assertPhotoLimit(params.photos, limits);

  const { data, error } = await supabase
    .from('products')
    .insert({
      business_id: params.businessId,
      name: params.name,
      description: params.description ?? null,
      category_id: params.categoryId,
      reference_price: params.referencePrice ?? null,
      stock: params.stock ?? 0,
      photos: params.photos ?? [],
      min_order_quantity: params.minOrderQuantity ?? null,
      price_tiers: params.priceTiers ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(
  id: string,
  updates: Partial<{
    name: string;
    description: string | null;
    category_id: string;
    reference_price: number | null;
    stock: number;
    is_active: boolean;
    photos: string[];
    min_order_quantity: number | null;
    price_tiers: ProductPriceTier[] | null;
  }>
): Promise<Product> {
  if (updates.photos) {
    const { data: current } = await supabase.from('products').select('business_id').eq('id', id).maybeSingle();
    if (current) assertPhotoLimit(updates.photos, await getPlanLimits(current.business_id));
  }

  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}
