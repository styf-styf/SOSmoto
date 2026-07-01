import { supabase } from './supabase';
import { notifyUser } from './notifications';
import type { ProductIntent, ProductIntentWithProduct, ProductIntentStatus } from '../types/database';

export async function getClientIntentForProduct(
  clientId: string,
  productId: string
): Promise<ProductIntent | null> {
  const { data, error } = await supabase
    .from('product_intents')
    .select('*')
    .eq('client_id', clientId)
    .eq('product_id', productId)
    .eq('status', 'pending')
    .maybeSingle();
  if (error) throw error;
  return data as ProductIntent | null;
}

export async function createProductIntent(
  clientId: string,
  productId: string,
  businessId: string
): Promise<ProductIntent> {
  const { data, error } = await supabase
    .from('product_intents')
    .insert({ client_id: clientId, product_id: productId, business_id: businessId })
    .select()
    .single();
  if (error) throw error;

  const { data: business } = await supabase
    .from('businesses')
    .select('owner_id')
    .eq('id', businessId)
    .maybeSingle();
  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .maybeSingle();
  if (business?.owner_id && product?.name) {
    await notifyUser(
      business.owner_id,
      'Producto apartado',
      `Un cliente quiere apartar: ${product.name}`,
      { type: 'product_intent', productId, businessId }
    );
  }

  return data as ProductIntent;
}

export async function cancelProductIntent(intentId: string): Promise<void> {
  const { error } = await supabase
    .from('product_intents')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', intentId);
  if (error) throw error;
}

export async function updateIntentStatus(
  intentId: string,
  status: ProductIntentStatus
): Promise<void> {
  const { error } = await supabase
    .from('product_intents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', intentId);
  if (error) throw error;
}

export async function getPendingIntentsForBusinessClient(
  businessId: string,
  clientId: string
): Promise<ProductIntentWithProduct[]> {
  const { data, error } = await supabase
    .from('product_intents')
    .select('*, products(name, reference_price)')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as unknown as (ProductIntent & { products: { name: string; reference_price: number | null } | null })[]).map(
    (row) => ({
      ...row,
      product_name: row.products?.name ?? 'Producto',
      product_price: row.products?.reference_price ?? null,
    })
  );
}

export async function getBusinessIntentStats(
  businessId: string
): Promise<{ pending: number; confirmed: number }> {
  const { data, error } = await supabase
    .from('product_intents')
    .select('status')
    .eq('business_id', businessId)
    .in('status', ['pending', 'confirmed']);
  if (error) throw error;
  const rows = data ?? [];
  return {
    pending: rows.filter((r) => r.status === 'pending').length,
    confirmed: rows.filter((r) => r.status === 'confirmed').length,
  };
}
