// Subconjunto de tipos de la app (types/database.ts en la raíz del repo),
// duplicado a propósito: admin/ se despliega como un proyecto Vercel
// independiente con Root Directory = admin, así que no debe depender de
// archivos fuera de esta carpeta.
export type UserRole = 'client' | 'business' | 'admin';

export interface AdminUserRow {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: UserRole;
  is_suspended: boolean;
  created_at: string;
}

export type BusinessType = 'workshop' | 'store' | 'brand_advertiser';

export interface AdminBusinessRow {
  id: string;
  owner_id: string;
  business_type: BusinessType;
  name: string;
  city: string;
  is_verified: boolean;
  is_suspended: boolean;
  followers_count: number;
  rating_avg: number;
  created_at: string;
  subscription_plans: { name: string } | null;
  users: { full_name: string; email: string } | null;
}

export interface AdminStoryRow {
  id: string;
  business_id: string | null;
  client_id: string | null;
  image_url: string;
  caption: string | null;
  is_pinned: boolean;
  views: number;
  clicks: number;
  created_at: string;
  businesses: { name: string } | null;
  users: { full_name: string } | null;
}

export interface AdminPostRow {
  id: string;
  business_id: string | null;
  client_id: string | null;
  image_url: string | null;
  caption: string | null;
  comments_count: number;
  created_at: string;
  businesses: { name: string } | null;
  users: { full_name: string } | null;
}
