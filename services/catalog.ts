import { supabase } from './supabase';
import type { Product, Service } from '../types/database';

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
}

export interface ProductWithBusiness extends Product {
  business_name: string;
}

export async function getServiceById(id: string): Promise<ServiceWithBusiness | null> {
  const { data, error } = await supabase.from('services').select('*, businesses(name)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { businesses, ...service } = data as any;
  return { ...service, business_name: businesses?.name ?? '' } as ServiceWithBusiness;
}

export async function getProductById(id: string): Promise<ProductWithBusiness | null> {
  const { data, error } = await supabase.from('products').select('*, businesses(name)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { businesses, ...product } = data as any;
  return { ...product, business_name: businesses?.name ?? '' } as ProductWithBusiness;
}

export async function getServicesForBusinesses(businessIds: string[], limit = 20): Promise<ServiceWithBusiness[]> {
  if (businessIds.length === 0) return [];

  const { data, error } = await supabase
    .from('services')
    .select('*, businesses(name)')
    .in('business_id', businessIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    business_name: row.businesses?.name ?? '',
  })) as ServiceWithBusiness[];
}

export async function getProductsForBusinesses(businessIds: string[], limit = 20): Promise<ProductWithBusiness[]> {
  if (businessIds.length === 0) return [];

  const { data, error } = await supabase
    .from('products')
    .select('*, businesses(name)')
    .in('business_id', businessIds)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    ...row,
    business_name: row.businesses?.name ?? '',
  })) as ProductWithBusiness[];
}

export interface PlanLimits {
  planName: string;
  maxServices: number | null;
  maxProducts: number | null;
  maxEmployees: number | null;
  maxActiveStories: number | null;
}

export async function getPlanLimits(businessId: string): Promise<PlanLimits> {
  const { data, error } = await supabase
    .from('businesses')
    .select('subscription_plans(name, max_services, max_products, max_employees, max_active_stories)')
    .eq('id', businessId)
    .single();
  if (error) throw error;

  const plan = (data as any)?.subscription_plans;
  return {
    planName: plan?.name ?? 'free',
    maxServices: plan?.max_services ?? null,
    maxProducts: plan?.max_products ?? null,
    maxEmployees: plan?.max_employees ?? null,
    maxActiveStories: plan?.max_active_stories ?? null,
  };
}

export interface CreateServiceParams {
  businessId: string;
  name: string;
  description?: string;
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

  const { data, error } = await supabase
    .from('services')
    .insert({
      business_id: params.businessId,
      name: params.name,
      description: params.description ?? null,
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
    reference_price: number | null;
    is_active: boolean;
    photos: string[];
  }>
): Promise<Service> {
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
  category?: string;
  referencePrice?: number;
  stock?: number;
  photos?: string[];
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

  const { data, error } = await supabase
    .from('products')
    .insert({
      business_id: params.businessId,
      name: params.name,
      description: params.description ?? null,
      category: params.category ?? null,
      reference_price: params.referencePrice ?? null,
      stock: params.stock ?? 0,
      photos: params.photos ?? [],
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
    category: string | null;
    reference_price: number | null;
    stock: number;
    is_active: boolean;
    photos: string[];
  }>
): Promise<Product> {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data as Product;
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}
