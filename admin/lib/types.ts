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
  is_limited: boolean;
  limitation_reason: string | null;
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
  is_limited: boolean;
  limitation_reason: string | null;
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
  photos: string[];
  caption: string | null;
  comments_count: number;
  created_at: string;
  businesses: { name: string } | null;
  users: { full_name: string } | null;
}

export type AdStatus = 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';

export interface AdminAdRow {
  id: string;
  business_id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  target_city: string | null;
  status: AdStatus;
  starts_at: string;
  ends_at: string;
  impressions: number;
  clicks: number;
  created_at: string;
  businesses: { name: string } | null;
}

export type PlanName = 'free' | 'standard' | 'pro';

export interface AdminSubscriptionPlanRow {
  id: string;
  name: PlanName;
  max_products: number | null;
  max_services: number | null;
  max_photos_per_item: number;
  max_employees: number | null;
  has_priority_matching: boolean;
  has_featured_listing: boolean;
  has_stories: boolean;
  max_active_stories: number | null;
  price_monthly: number;
}

export type PaymentType = 'subscription' | 'advertising';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface AdminPaymentRow {
  id: string;
  business_id: string;
  amount: number;
  currency: string;
  type: PaymentType;
  gateway: string;
  status: PaymentStatus;
  created_at: string;
  businesses: { name: string } | null;
}

export interface AdminBusinessSubscriptionRow {
  id: string;
  business_id: string;
  status: 'active' | 'expired' | 'cancelled';
  started_at: string;
  expires_at: string | null;
  businesses: { name: string; subscription_plans: { name: PlanName } | null } | null;
}

export type HelpRequestStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export type DisputeStatus = 'none' | 'flagged' | 'reviewed';

export interface AdminHelpRequestRow {
  id: string;
  client_id: string;
  status: HelpRequestStatus;
  accepted_business_id: string | null;
  estimated_arrival_minutes: number | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  admin_notes: string | null;
  dispute_status: DisputeStatus;
  users: { full_name: string } | null;
  businesses: { name: string; city: string } | null;
}

export type MotoType = 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser';

export interface AdminMaintenanceRuleRow {
  id: string;
  moto_type: MotoType;
  service_name: string;
  interval_km: number | null;
  interval_months: number | null;
}

export interface AdminAdPricingRow {
  price_per_day_city: number;
  price_per_day_national: number;
}

export type CategoryKind = 'product' | 'service';
export type CategoryStatus = 'approved' | 'pending';

export interface AdminCategoryRow {
  id: string;
  name: string;
  kind: CategoryKind;
  status: CategoryStatus;
  created_at: string;
}

export interface AdminProductRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  reference_price: number | null;
  stock: number;
  photos: string[];
  is_active: boolean;
  created_at: string;
  businesses: { name: string } | null;
}

export interface AdminServiceRow {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  reference_price: number | null;
  photos: string[];
  is_active: boolean;
  created_at: string;
  businesses: { name: string } | null;
}

export interface AdminReviewRow {
  id: string;
  reviewer_id: string;
  reviewed_business_id: string | null;
  reviewed_client_id: string | null;
  rating: number;
  comment: string | null;
  is_public: boolean;
  created_at: string;
  reviewer: { full_name: string } | null;
  reviewed_business: { name: string } | null;
  reviewed_client: { full_name: string } | null;
}

export interface AdminSystemSettingsRow {
  default_aid_radius_km: number;
}

export type ReportTargetType = 'post' | 'review' | 'business' | 'product' | 'service';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface AdminReportRow {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string | null;
  status: ReportStatus;
  created_at: string;
  users: { full_name: string } | null;
  targetLabel: string;
}

export type KycStatus = 'pending_review' | 'approved' | 'rejected';

export interface AdminVerificationRequestRow {
  id: string;
  business_id: string;
  id_document_path: string;
  ruc_document_path: string | null;
  storefront_photo_path: string;
  notes: string | null;
  status: KycStatus;
  admin_notes: string | null;
  created_at: string;
  businesses: { name: string; city: string; is_verified: boolean } | null;
}
