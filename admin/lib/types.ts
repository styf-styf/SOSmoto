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
