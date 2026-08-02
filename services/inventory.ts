import { supabase } from './supabase';
import { getProductVariants, syncProductStockFromVariants } from './catalog';
import type { Product, ProductVariant, StockMovement, StockMovementReason } from '../types/database';

export type { StockMovementReason };

export const REASON_LABEL: Record<StockMovementReason, string> = {
  entry: 'Entrada',
  sale: 'Venta',
  adjustment: 'Ajuste',
  damage: 'Daño / pérdida',
  other: 'Otro',
};

export interface ProductWithMovements extends Product {
  stockLevel: 'out' | 'low' | 'ok';
  category_name: string;
  variants: (ProductVariant & { stockLevel: 'out' | 'low' | 'ok' })[];
}

const LOW_STOCK_THRESHOLD = 5;

function stockLevel(stock: number): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

// Todos los productos del negocio enriquecidos con su nivel de stock (y el
// de cada variante, si tiene), ordenados de menor a mayor stock.
export async function getInventory(businessId: string): Promise<ProductWithMovements[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*, categories(name)')
    .eq('business_id', businessId)
    .order('stock', { ascending: true });
  if (error) throw error;
  const products = (data ?? []) as any[];

  const productIds = products.map((p) => p.id);
  const variantsByProduct = new Map<string, ProductVariant[]>();
  if (productIds.length > 0) {
    const { data: variantRows, error: variantsError } = await supabase
      .from('product_variants')
      .select('*')
      .in('product_id', productIds)
      .eq('is_active', true)
      .order('created_at', { ascending: true });
    if (variantsError) throw variantsError;
    for (const v of (variantRows ?? []) as ProductVariant[]) {
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push(v);
      variantsByProduct.set(v.product_id, list);
    }
  }

  return products.map((p) => {
    const { categories, ...product } = p;
    const variants = (variantsByProduct.get(p.id) ?? []).map((v) => ({ ...v, stockLevel: stockLevel(v.stock) }));
    return { ...product, stockLevel: stockLevel(p.stock), category_name: categories?.name ?? '', variants };
  }) as ProductWithMovements[];
}

export interface StockMovementWithClient extends StockMovement {
  client_name: string | null;
}

// Últimos movimientos de un producto (o de una variante puntual, si se pasa variantId).
export async function getStockMovements(
  productId: string,
  variantId: string | null = null,
  limit = 20
): Promise<StockMovementWithClient[]> {
  let query = supabase
    .from('stock_movements')
    .select('*, users(full_name)')
    .eq('product_id', productId);
  query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as (StockMovement & { users: { full_name: string } | null })[]).map((row) => {
    const { users, ...movement } = row;
    return { ...movement, client_name: users?.full_name ?? null };
  });
}

export interface BusinessStockMovement extends StockMovementWithClient {
  product_name: string;
  variant_label: string | null;
}

// Historial global (todos los productos del negocio juntos, no uno a la
// vez) -- misma data que getStockMovements pero sin acotar a un producto,
// para la pantalla "Historial de movimientos" del menú de Inventario.
export async function getBusinessStockMovements(
  businessId: string,
  limit = 50,
  before?: string
): Promise<BusinessStockMovement[]> {
  let query = supabase
    .from('stock_movements')
    .select('*, products(name), product_variants(label), users(full_name)')
    .eq('business_id', businessId);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (
    (data ?? []) as unknown as (StockMovement & {
      products: { name: string } | null;
      product_variants: { label: string } | null;
      users: { full_name: string } | null;
    })[]
  ).map((row) => {
    const { products, product_variants, users, ...movement } = row;
    return {
      ...movement,
      client_name: users?.full_name ?? null,
      product_name: products?.name ?? 'Producto',
      variant_label: product_variants?.label ?? null,
    };
  });
}

export interface AddMovementParams {
  businessId: string;
  productId: string;
  delta: number;
  reason: StockMovementReason;
  notes?: string;
  currentStock?: number; // si se omite, se consulta de la BD
  clientId?: string | null; // presente solo cuando el movimiento viene de una venta por apartado
}

// Registra un movimiento y actualiza products.stock en una sola operación lógica.
// delta > 0 = entrada, delta < 0 = salida/daño.
// Para 'adjustment', el llamador ya calcula delta = nuevoStock - stockActual.
export async function addStockMovement(params: AddMovementParams): Promise<Product> {
  let current = params.currentStock;
  if (current === undefined) {
    const { data } = await supabase.from('products').select('stock').eq('id', params.productId).single();
    current = (data as any)?.stock ?? 0;
  }
  const newStock = (current ?? 0) + params.delta;
  if (newStock < 0) throw new Error('El stock no puede quedar negativo.');

  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: params.productId,
    business_id: params.businessId,
    delta: params.delta,
    reason: params.reason,
    notes: params.notes ?? null,
    client_id: params.clientId ?? null,
  });
  if (movErr) throw movErr;

  const { data, error: updErr } = await supabase
    .from('products')
    .update({ stock: newStock })
    .eq('id', params.productId)
    .select()
    .single();
  if (updErr) throw updErr;
  return data as Product;
}

export interface AddVariantMovementParams {
  businessId: string;
  productId: string;
  variantId: string;
  delta: number;
  reason: StockMovementReason;
  notes?: string;
  currentStock?: number; // si se omite, se consulta de la BD
  clientId?: string | null; // presente solo cuando el movimiento viene de una venta por apartado
}

// Igual que addStockMovement pero para una variante puntual -- además
// resincroniza products.stock (suma de variantes) al final.
export async function addVariantStockMovement(params: AddVariantMovementParams): Promise<ProductVariant> {
  let current = params.currentStock;
  if (current === undefined) {
    const { data } = await supabase.from('product_variants').select('stock').eq('id', params.variantId).single();
    current = (data as any)?.stock ?? 0;
  }
  const newStock = (current ?? 0) + params.delta;
  if (newStock < 0) throw new Error('El stock no puede quedar negativo.');

  const { error: movErr } = await supabase.from('stock_movements').insert({
    product_id: params.productId,
    variant_id: params.variantId,
    business_id: params.businessId,
    delta: params.delta,
    reason: params.reason,
    notes: params.notes ?? null,
    client_id: params.clientId ?? null,
  });
  if (movErr) throw movErr;

  const { data, error: updErr } = await supabase
    .from('product_variants')
    .update({ stock: newStock })
    .eq('id', params.variantId)
    .select()
    .single();
  if (updErr) throw updErr;

  await syncProductStockFromVariants(params.productId);

  return data as ProductVariant;
}
