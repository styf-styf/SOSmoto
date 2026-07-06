import { supabase } from './supabase';
import type { Product, StockMovement, StockMovementReason } from '../types/database';

export type { StockMovementReason };

export interface ProductWithMovements extends Product {
  stockLevel: 'out' | 'low' | 'ok';
}

const LOW_STOCK_THRESHOLD = 5;

function stockLevel(stock: number): 'out' | 'low' | 'ok' {
  if (stock <= 0) return 'out';
  if (stock <= LOW_STOCK_THRESHOLD) return 'low';
  return 'ok';
}

// Todos los productos del negocio enriquecidos con su nivel de stock, ordenados de menor a mayor stock.
export async function getInventory(businessId: string): Promise<ProductWithMovements[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('business_id', businessId)
    .order('stock', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((p: any) => ({ ...p, stockLevel: stockLevel(p.stock) })) as ProductWithMovements[];
}

// Últimos movimientos de un producto.
export async function getStockMovements(
  productId: string,
  limit = 20
): Promise<StockMovement[]> {
  const { data, error } = await (supabase.from('stock_movements') as any)
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as StockMovement[];
}

export interface AddMovementParams {
  businessId: string;
  productId: string;
  delta: number;
  reason: StockMovementReason;
  notes?: string;
  currentStock: number;
}

// Registra un movimiento y actualiza products.stock en una sola operación lógica.
// delta > 0 = entrada, delta < 0 = salida/daño.
// Para 'adjustment', el llamador ya calcula delta = nuevoStock - stockActual.
export async function addStockMovement(params: AddMovementParams): Promise<Product> {
  const newStock = params.currentStock + params.delta;
  if (newStock < 0) throw new Error('El stock no puede quedar negativo.');

  const { error: movErr } = await (supabase.from('stock_movements') as any).insert({
    product_id: params.productId,
    business_id: params.businessId,
    delta: params.delta,
    reason: params.reason,
    notes: params.notes ?? null,
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
