import { supabase } from './supabase';
import { notifyUser } from './notifications';
import { addStockMovement, addVariantStockMovement } from './inventory';
import { getEffectiveUnitPrice } from './catalog';
import type { ProductIntent, ProductIntentWithProduct, ProductIntentWithDetails, ProductIntentStatus, ProductPriceTier, Review } from '../types/database';

// Precio por unidad de un intent, calculando el escalón de volumen que
// corresponde a la cantidad pedida -- el precio base es el de la variante si
// existe (o el del producto si no), pero min_order_quantity siempre es del
// producto (las variantes no tienen su propio MOQ, ver getEffectiveUnitPrice).
function intentUnitPrice(
  product: { reference_price: number | null; min_order_quantity?: number | null; price_tiers?: ProductPriceTier[] | null } | null,
  variant: { reference_price: number | null; price_tiers?: ProductPriceTier[] | null } | null,
  quantity: number
): number | null {
  if (!product) return variant?.reference_price ?? null;
  const basePrice = variant?.reference_price ?? product.reference_price;
  const tiers = variant?.price_tiers ?? product.price_tiers ?? null;
  return getEffectiveUnitPrice(basePrice, product.min_order_quantity ?? null, tiers, quantity);
}

// Junta nombre de producto + etiqueta de variante (ej. "Casco MT (Talla M)")
// para mostrar en notificaciones y mensajes de chat automáticos.
function withVariantLabel(name: string, variantLabel?: string | null): string {
  return variantLabel ? `${name} (${variantLabel})` : name;
}

// product_intents lo usa tanto un cliente comprando en una tienda/taller
// como un taller/tienda pidiendo al por mayor a otro negocio (ver
// getMyProductPurchases) -- las notificaciones al vendedor deben decir quién
// pide, no asumir siempre "un cliente". Si el comprador es dueño de un
// negocio, usamos su nombre comercial; si no, "Un cliente".
async function getBuyerLabel(buyerId: string): Promise<string> {
  const { data } = await supabase.from('businesses').select('name').eq('owner_id', buyerId).maybeSingle();
  return data?.name ?? 'Un cliente';
}

export async function getClientIntentForProduct(
  clientId: string,
  productId: string,
  variantId: string | null = null
): Promise<ProductIntent | null> {
  let query = supabase
    .from('product_intents')
    .select('*')
    .eq('client_id', clientId)
    .eq('product_id', productId)
    .in('status', ['pending', 'confirmed']);
  query = variantId ? query.eq('variant_id', variantId) : query.is('variant_id', null);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as ProductIntent | null;
}

export async function createProductIntent(
  clientId: string,
  productId: string,
  businessId: string,
  quantity: number = 1,
  variantId: string | null = null
): Promise<ProductIntent> {
  const { data, error } = await supabase
    .from('product_intents')
    .insert({ client_id: clientId, product_id: productId, variant_id: variantId, business_id: businessId, quantity })
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
  let variantLabel: string | null = null;
  if (variantId) {
    const { data: variant } = await supabase.from('product_variants').select('label').eq('id', variantId).maybeSingle();
    variantLabel = variant?.label ?? null;
  }
  if (business?.owner_id && product?.name) {
    const qtyPrefix = quantity > 1 ? `${quantity} x ` : '';
    const buyerLabel = await getBuyerLabel(clientId);
    await notifyUser(
      business.owner_id,
      'Producto apartado',
      `${buyerLabel} quiere apartar: ${qtyPrefix}${withVariantLabel(product.name, variantLabel)}`,
      { type: 'product_intent', productId, businessId }
    );
  }

  return data as ProductIntent;
}

export async function cancelProductIntent(intentId: string): Promise<void> {
  const { data: intent, error: fetchError } = await supabase
    .from('product_intents')
    .select('client_id, product_id, variant_id, business_id, quantity')
    .eq('id', intentId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { error } = await supabase
    .from('product_intents')
    .update({ status: 'cancelled_by_client', updated_at: new Date().toISOString() })
    .eq('id', intentId);
  if (error) throw error;

  if (intent) {
    const { data: business } = await supabase
      .from('businesses')
      .select('owner_id')
      .eq('id', intent.business_id)
      .maybeSingle();
    const { data: product } = await supabase
      .from('products')
      .select('name')
      .eq('id', intent.product_id)
      .maybeSingle();
    let variantLabel: string | null = null;
    if (intent.variant_id) {
      const { data: variant } = await supabase.from('product_variants').select('label').eq('id', intent.variant_id).maybeSingle();
      variantLabel = variant?.label ?? null;
    }
    const productName = withVariantLabel(product?.name ?? 'un producto', variantLabel);
    const qtyPrefix = intent.quantity > 1 ? `${intent.quantity} x ` : '';
    const buyerLabel = await getBuyerLabel(intent.client_id);

    if (business?.owner_id) {
      await notifyUser(
        business.owner_id,
        'Apartado cancelado',
        `${buyerLabel} canceló: ${qtyPrefix}${productName}`,
        { type: 'product_intent', productId: intent.product_id, businessId: intent.business_id }
      );
    }
  }
}

export async function updateIntentStatus(
  intentId: string,
  status: ProductIntentStatus
): Promise<void> {
  const { data: intent, error: fetchError } = await supabase
    .from('product_intents')
    .select('client_id, product_id, variant_id, business_id, quantity, status')
    .eq('id', intentId)
    .maybeSingle();
  if (fetchError) throw fetchError;
  if (!intent) return;

  // Evita descontar stock dos veces para la misma venta (doble tap, o dos
  // llamadas concurrentes) si el intent ya estaba marcado como vendido.
  if (status === 'sold' && intent.status === 'sold') return;

  if (status === 'sold') {
    // El movimiento de stock va ANTES de marcar la venta -- si falla (ej. no
    // hay stock suficiente), el intent se queda en su estado anterior en vez
    // de quedar marcado "vendido" sin haber descontado nada del inventario.
    if (intent.variant_id) {
      await addVariantStockMovement({
        businessId: intent.business_id,
        productId: intent.product_id,
        variantId: intent.variant_id,
        delta: -intent.quantity,
        reason: 'sale',
      });
    } else {
      await addStockMovement({
        businessId: intent.business_id,
        productId: intent.product_id,
        delta: -intent.quantity,
        reason: 'sale',
      });
    }
  }

  const { error } = await supabase
    .from('product_intents')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', intentId);
  if (error) throw error;

  if (status === 'confirmed' || status === 'sold' || status === 'unavailable' || status === 'cancelled_no_show') {
    const { data: product } = await supabase
      .from('products')
      .select('name')
      .eq('id', intent.product_id)
      .maybeSingle();
    let variantLabel: string | null = null;
    if (intent.variant_id) {
      const { data: variant } = await supabase.from('product_variants').select('label').eq('id', intent.variant_id).maybeSingle();
      variantLabel = variant?.label ?? null;
    }
    const productName = withVariantLabel(product?.name ?? 'tu producto', variantLabel);
    const title =
      status === 'confirmed' ? 'Apartado confirmado' :
      status === 'sold' ? '¡Compra confirmada!' :
      status === 'unavailable' ? 'Producto no disponible' :
      'Venta cancelada';
    const body =
      status === 'confirmed'
        ? `Tu apartado de "${productName}" fue confirmado por el negocio`
        : status === 'sold'
        ? `Retiraste "${productName}". ¡Gracias por tu compra!`
        : status === 'unavailable'
        ? `El negocio indicó que "${productName}" no está disponible en este momento`
        : `La venta de "${productName}" fue cancelada por el negocio`;
    await notifyUser(intent.client_id, title, body, { type: 'product_intent', productId: intent.product_id, businessId: intent.business_id });

    if (status === 'sold') {
      await notifyUser(
        intent.client_id,
        'Califica tu compra',
        `Contanos cómo te fue con "${productName}" y calificá a la tienda.`,
        { type: 'rate_business', businessId: intent.business_id }
      );
    }
  }
}

export async function getPendingIntentsForBusinessClient(
  businessId: string,
  clientId: string
): Promise<ProductIntentWithProduct[]> {
  const { data, error } = await supabase
    .from('product_intents')
    .select('*, products(name, reference_price, min_order_quantity, price_tiers), product_variants(label, reference_price, price_tiers)')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (
    (data ?? []) as unknown as (ProductIntent & {
      products: { name: string; reference_price: number | null; min_order_quantity: number | null; price_tiers: ProductPriceTier[] | null } | null;
      product_variants: { label: string; reference_price: number | null; price_tiers: ProductPriceTier[] | null } | null;
    })[]
  ).map((row) => ({
    ...row,
    product_name: withVariantLabel(row.products?.name ?? 'Producto', row.product_variants?.label),
    product_price: intentUnitPrice(row.products, row.product_variants, row.quantity),
  }));
}

export function subscribeToClientIntent(
  clientId: string,
  productId: string,
  variantId: string | null,
  onUpdate: (intent: ProductIntent | null) => void,
  onUnavailable?: () => void
) {
  const channel = supabase
    .channel(`product_intent_${clientId}_${productId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'product_intents', filter: `client_id=eq.${clientId}` },
      (payload) => {
        const row = payload.new as ProductIntent;
        if (row.product_id !== productId) return;
        if ((row.variant_id ?? null) !== (variantId ?? null)) return;
        if (row.status === 'confirmed' || row.status === 'pending') {
          onUpdate(row);
        } else {
          onUpdate(null);
          if (row.status === 'unavailable') onUnavailable?.();
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Avisa (sin payload propio, el caller vuelve a pedir la lista) cuando cambia
// algún product_intent de este cliente con este negocio -- usado por el
// banner de apartados pendientes en el chat.
export function subscribeToClientProductIntentsForBusiness(
  clientId: string,
  businessId: string,
  onChange: () => void
) {
  const channel = supabase
    .channel(`product_intents_biz_${clientId}_${businessId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'product_intents', filter: `client_id=eq.${clientId}` },
      (payload) => {
        const row = (payload.new ?? payload.old) as ProductIntent;
        if (row.business_id === businessId) onChange();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Lado negocio: avisa con la etiqueta ya armada ("2 x Casco MT") cuando el
// cliente cancela un apartado pendiente -- reemplaza el mensaje automático
// que antes se insertaba en el chat (ver cancelProductIntent) por un aviso
// en vivo para la tarjeta "Cancelado" del banner de apartados.
export function subscribeToProductIntentCancelled(
  businessId: string,
  clientId: string,
  onCancelled: (intentId: string, label: string) => void
) {
  const channel = supabase
    .channel(`product_intent_cancel_${businessId}_${clientId}_${Math.random().toString(36).slice(2)}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'product_intents', filter: `business_id=eq.${businessId}` },
      async (payload) => {
        const row = payload.new as ProductIntent;
        if (row.client_id !== clientId || row.status !== 'cancelled_by_client') return;
        const { data: product } = await supabase.from('products').select('name').eq('id', row.product_id).maybeSingle();
        let variantLabel: string | null = null;
        if (row.variant_id) {
          const { data: variant } = await supabase.from('product_variants').select('label').eq('id', row.variant_id).maybeSingle();
          variantLabel = variant?.label ?? null;
        }
        const qtyPrefix = row.quantity > 1 ? `${row.quantity} × ` : '';
        onCancelled(row.id, `${qtyPrefix}${withVariantLabel(product?.name ?? 'un producto', variantLabel)}`);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function getBusinessProductIntents(businessId: string): Promise<ProductIntentWithDetails[]> {
  const { data, error } = await supabase
    .from('product_intents')
    .select(
      '*, products(name, reference_price, min_order_quantity, price_tiers), product_variants(label, reference_price, price_tiers), users(full_name, phone, avatar_url)'
    )
    .eq('business_id', businessId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as (ProductIntent & {
    products: { name: string; reference_price: number | null; min_order_quantity: number | null; price_tiers: ProductPriceTier[] | null } | null;
    product_variants: { label: string; reference_price: number | null; price_tiers: ProductPriceTier[] | null } | null;
    users: { full_name: string; phone: string | null; avatar_url: string | null } | null;
  })[];

  const buyerIds = [...new Set(rows.map((row) => row.client_id))];
  const buyerBusinessByOwnerId = new Map<string, string>();
  if (buyerIds.length > 0) {
    const { data: buyerBusinesses } = await supabase.from('businesses').select('owner_id, name').in('owner_id', buyerIds);
    (buyerBusinesses ?? []).forEach((b: { owner_id: string; name: string }) => buyerBusinessByOwnerId.set(b.owner_id, b.name));
  }

  return rows.map((row) => ({
    ...row,
    product_name: withVariantLabel(row.products?.name ?? 'Producto', row.product_variants?.label),
    product_price: intentUnitPrice(row.products, row.product_variants, row.quantity),
    client_name: row.users?.full_name ?? 'Cliente',
    client_phone: row.users?.phone ?? null,
    client_avatar_url: row.users?.avatar_url ?? null,
    buyer_business_name: buyerBusinessByOwnerId.get(row.client_id) ?? null,
  }));
}

export async function getClientProductIntents(
  businessId: string,
  clientId: string
): Promise<ProductIntentWithProduct[]> {
  const { data, error } = await supabase
    .from('product_intents')
    .select('*, products(name, reference_price, min_order_quantity, price_tiers), product_variants(label, reference_price, price_tiers)')
    .eq('business_id', businessId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (
    (data ?? []) as unknown as (ProductIntent & {
      products: { name: string; reference_price: number | null; min_order_quantity: number | null; price_tiers: ProductPriceTier[] | null } | null;
      product_variants: { label: string; reference_price: number | null; price_tiers: ProductPriceTier[] | null } | null;
    })[]
  ).map((row) => ({
    ...row,
    product_name: withVariantLabel(row.products?.name ?? 'Producto', row.product_variants?.label),
    product_price: intentUnitPrice(row.products, row.product_variants, row.quantity),
  }));
}

// Estadísticas de un producto puntual (para la vista del negocio en su
// propia página de producto: reservas activas y unidades vendidas).
export async function getProductIntentStats(productId: string): Promise<{ reservations: number; sold: number }> {
  const { data, error } = await supabase
    .from('product_intents')
    .select('status')
    .eq('product_id', productId)
    .in('status', ['pending', 'confirmed', 'sold']);
  if (error) throw error;
  const rows = data ?? [];
  return {
    reservations: rows.filter((r) => r.status === 'pending' || r.status === 'confirmed').length,
    sold: rows.filter((r) => r.status === 'sold').length,
  };
}


export interface MyProductPurchase {
  id: string;
  status: ProductIntentStatus;
  createdAt: string;
  updatedAt: string;
  productId: string;
  productName: string;
  productPrice: number | null;
  quantity: number;
  businessId: string;
  businessName: string;
  review: Review | null;
}

// Compras hechas por el usuario actual como comprador (ej. un taller apartando
// productos de una tienda) -- mismo mecanismo de product_intents, visto desde
// el otro lado. Reusa reviews.product_intent_id para la calificación.
export async function getMyProductPurchases(userId: string): Promise<MyProductPurchase[]> {
  const { data, error } = await supabase
    .from('product_intents')
    .select(
      '*, products(name, reference_price, min_order_quantity, price_tiers), product_variants(label, reference_price, price_tiers), businesses(name)'
    )
    .eq('client_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as unknown as (ProductIntent & {
    products: { name: string; reference_price: number | null; min_order_quantity: number | null; price_tiers: ProductPriceTier[] | null } | null;
    product_variants: { label: string; reference_price: number | null; price_tiers: ProductPriceTier[] | null } | null;
    businesses: { name: string } | null;
  })[];

  const soldIds = rows.filter((r) => r.status === 'sold').map((r) => r.id);
  let reviewByIntentId = new Map<string, Review>();
  if (soldIds.length > 0) {
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .in('product_intent_id', soldIds);
    if (reviewsError) throw reviewsError;
    reviewByIntentId = new Map(
      ((reviews ?? []) as Review[])
        .filter((r) => r.product_intent_id)
        .map((r) => [r.product_intent_id as string, r])
    );
  }

  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    productId: r.product_id,
    productName: withVariantLabel(r.products?.name ?? 'Producto', r.product_variants?.label),
    productPrice: intentUnitPrice(r.products, r.product_variants, r.quantity),
    quantity: r.quantity,
    businessId: r.business_id,
    businessName: r.businesses?.name ?? 'Negocio',
    review: reviewByIntentId.get(r.id) ?? null,
  }));
}
