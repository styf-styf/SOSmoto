export type UserRole = 'client' | 'business' | 'admin';

export interface User {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  push_token: string | null;
  is_limited: boolean;
  limitation_reason: string | null;
  created_at: string;
}

export interface VehicleInfo {
  brand: string;
  model: string;
  year: number;
  plate?: string | null;
}

export function formatVehicle(v: VehicleInfo | null | undefined): string | null {
  if (!v) return null;
  return `${v.brand} ${v.model} ${v.year}`;
}

export interface Vehicle {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year: number;
  plate: string | null;
  current_mileage: number;
  last_mileage_update: string;
  moto_type: MotoType | null;
  avg_monthly_km: number | null;
  last_mileage_reminder_at: string | null;
  created_at: string;
}

export type BusinessType = 'workshop' | 'store' | 'brand_advertiser';

export interface BusinessSchedule {
  [day: string]: { open: string; close: string } | null;
}

export interface Business {
  id: string;
  owner_id: string;
  business_type: BusinessType;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string;
  city: string;
  province: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  whatsapp: string | null;
  schedule: BusinessSchedule | null;
  is_verified: boolean;
  rating_avg: number;
  followers_count: number;
  plan_id: string;
  aid_radius_km: number | null;
  is_available_for_aid: boolean;
  is_24h: boolean;
  is_limited: boolean;
  limitation_reason: string | null;
  promotion_claimed_at: string | null;
  created_at: string;
}

export type EmployeeRole = 'owner' | 'mechanic';

export interface BusinessEmployee {
  id: string;
  business_id: string;
  user_id: string;
  role: EmployeeRole;
  job_title: string | null;
  can_accept_aid_requests: boolean;
  can_manage_catalog: boolean;
  can_reply_chat: boolean;
  can_upload_stories: boolean;
  can_create_posts: boolean;
  created_at: string;
}

export interface EmployeeRemovalNotice {
  id: string;
  user_id: string;
  business_name: string;
  created_at: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'rejected';

export interface EmployeeInvitation {
  id: string;
  business_id: string;
  invitee_id: string;
  job_title: string | null;
  can_accept_aid_requests: boolean;
  can_manage_catalog: boolean;
  can_reply_chat: boolean;
  can_upload_stories: boolean;
  can_create_posts: boolean;
  status: InvitationStatus;
  created_at: string;
  updated_at: string;
}

export interface EmployeeInvitationWithBusiness extends EmployeeInvitation {
  business_name: string;
  business_logo_url: string | null;
}

export interface EmployeeInvitationWithInvitee extends EmployeeInvitation {
  invitee_name: string;
  invitee_email: string;
}

export type PlanName = 'free' | 'standard' | 'pro';

export interface SubscriptionPlan {
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

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled';

export interface BusinessSubscription {
  id: string;
  business_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  started_at: string;
  expires_at: string | null;
  payment_id: string | null;
  promotion_id: string | null;
  reminder_sent_at: string | null;
}

export interface PlanPromotion {
  id: string;
  plan_id: string;
  duration_days: number;
  is_active: boolean;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivePlanPromotion {
  id: string;
  plan_id: string;
  plan_name: PlanName;
  duration_days: number;
  activated_at: string;
  applies_to_all_businesses: boolean;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  category_id: string;
  reference_price: number | null;
  photos: string[];
  is_active: boolean;
  views: number;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  category_id: string;
  reference_price: number | null;
  stock: number;
  photos: string[];
  is_active: boolean;
  views: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  label: string;
  stock: number;
  reference_price: number | null;
  is_active: boolean;
  created_at: string;
}

export type CategoryKind = 'product' | 'service';
export type CategoryStatus = 'approved' | 'pending';

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  status: CategoryStatus;
  created_at: string;
}

export type StockMovementReason = 'entry' | 'sale' | 'adjustment' | 'damage' | 'other';

export interface StockMovement {
  id: string;
  product_id: string;
  variant_id: string | null;
  business_id: string;
  delta: number;
  reason: StockMovementReason;
  notes: string | null;
  created_at: string;
}

export type HelpRequestStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type DisputeStatus = 'none' | 'flagged' | 'reviewed';

export interface HelpRequest {
  id: string;
  client_id: string;
  vehicle_id: string;
  latitude: number;
  longitude: number;
  description: string | null;
  status: HelpRequestStatus;
  accepted_business_id: string | null;
  estimated_arrival_minutes: number | null;
  business_latitude: number | null;
  business_longitude: number | null;
  business_location_updated_at: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  admin_notes: string | null;
  dispute_status: DisputeStatus;
}

export type ReportTargetType = 'post' | 'review' | 'business' | 'product' | 'service';
export type ReportStatus = 'pending' | 'reviewed' | 'dismissed';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string | null;
  status: ReportStatus;
  created_at: string;
}

export interface HelpRequestNotification {
  id: string;
  help_request_id: string;
  business_id: string;
  notified_at: string;
  responded: boolean;
  out_of_range: boolean;
}

export type GrowthSuggestionType =
  | 'upgrade_plan_limit_reached'
  | 'upgrade_plan_near_limit'
  | 'advertise_low_visibility'
  | 'advertise_new_business';

export interface GrowthSuggestion {
  id: string;
  business_id: string;
  type: GrowthSuggestionType;
  title: string;
  body: string;
  status: 'active' | 'dismissed';
  created_at: string;
}

export interface Review {
  id: string;
  reviewer_id: string;
  reviewed_business_id: string | null;
  reviewed_client_id: string | null;
  help_request_id: string | null;
  appointment_id: string | null;
  product_intent_id: string | null;
  rating: number;
  comment: string | null;
  is_public: boolean;
  created_at: string;
}

export type AdStatus = 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';

export interface Ad {
  id: string;
  business_id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  target_city: string | null;
  status: AdStatus;
  starts_at: string;
  ends_at: string;
  payment_id: string | null;
  impressions: number;
  clicks: number;
  comments_count: number;
  created_at: string;
}

export interface AdComment {
  id: string;
  ad_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export type StoryActionType = 'service' | 'product' | 'contact' | 'business_tag' | 'none';

export interface Story {
  id: string;
  business_id: string | null;
  client_id: string | null;
  image_url: string;
  caption: string | null;
  action_type: StoryActionType;
  action_target_id: string | null;
  is_pinned: boolean;
  views: number;
  clicks: number;
  created_at: string;
}

export interface Post {
  id: string;
  business_id: string | null;
  client_id: string | null;
  photos: string[];
  caption: string | null;
  tag_business_id: string | null;
  tag_client_id: string | null;
  tag_service_id: string | null;
  tag_product_id: string | null;
  comments_count: number;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export type PaymentType = 'subscription' | 'advertising';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  business_id: string;
  amount: number;
  currency: string;
  type: PaymentType;
  gateway: string;
  gateway_transaction_id: string | null;
  client_transaction_id: string | null;
  plan_id: string | null;
  metadata: Record<string, unknown> | null;
  status: PaymentStatus;
  created_at: string;
}

export interface AdPricing {
  price_per_day_city: number;
  price_per_day_national: number;
}

export type MotoType = 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser';

export interface MaintenanceRule {
  id: string;
  moto_type: MotoType;
  service_name: string;
  interval_km: number | null;
  interval_months: number | null;
}

export type MaintenanceSuggestionStatus = 'pending' | 'notified' | 'dismissed' | 'completed';

export interface MaintenanceSuggestion {
  id: string;
  vehicle_id: string;
  rule_id: string;
  due_at_km: number | null;
  status: MaintenanceSuggestionStatus;
  overdue_notified_at: string | null;
  completed_at: string | null;
  completed_at_km: number | null;
  created_at: string;
}

export interface Message {
  id: string;
  client_id: string;
  business_id: string;
  sender_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
  read_at: string | null;
}

export type AppointmentStatus = 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  client_id: string | null;
  business_id: string;
  vehicle_id: string | null;
  service_id: string | null;
  requested_at: string | null;
  proposed_by: 'client' | 'business' | null;
  notes: string | null;
  status: AppointmentStatus;
  external_client_name: string | null;
  external_client_phone: string | null;
  created_at: string;
}

export interface ServiceReportPart {
  name: string;
  quantity: number;
}

export type InspectionStatus = 'ok' | 'attention' | 'critical' | 'na';

export interface InspectionItem {
  item: string;
  status: InspectionStatus;
}

export interface InspectionGroup {
  group: string;
  observations?: string | null;
  items: InspectionItem[];
}

export type ServiceCategory =
  | 'Mantenimiento preventivo'
  | 'Reparación'
  | 'Diagnóstico'
  | 'Revisión general'
  | 'Lavado / Estética'
  | 'Otro';

export interface ServiceReport {
  id: string;
  business_id: string;
  client_id: string | null;
  appointment_id: string | null;
  help_request_id: string | null;
  vehicle_id: string | null;
  vehicle_label: string | null;
  external_client_name: string | null;
  service_category: ServiceCategory | null;
  service_km: number | null;
  services_performed: string[];
  parts_used: ServiceReportPart[] | null;
  inspection_checklist: InspectionGroup[] | null;
  observations: string | null;
  recommendations: string | null;
  vehicle_plate: string | null;
  entry_date: string | null;
  exit_date: string | null;
  next_maintenance_km: number | null;
  next_maintenance_date: string | null;
  client_confirmed_at: string | null;
  status: 'draft' | 'sent';
  created_at: string;
}

export type KycStatus = 'pending_review' | 'approved' | 'rejected';

export interface BusinessVerificationRequest {
  id: string;
  business_id: string;
  id_document_path: string;
  ruc_document_path: string | null;
  storefront_photo_path: string;
  notes: string | null;
  status: KycStatus;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Follow {
  id: string;
  client_id: string;
  business_id: string;
  created_at: string;
}

export type AppointmentRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface AppointmentRequest {
  id: string;
  client_id: string;
  business_id: string;
  service_id: string | null;
  vehicle_id: string | null;
  service_name: string | null;
  vehicle_label: string | null;
  notes: string | null;
  suggested_at: string | null;
  status: AppointmentRequestStatus;
  created_at: string;
}

export type ProductIntentStatus =
  | 'pending'
  | 'confirmed'
  | 'sold'
  | 'unavailable'
  | 'cancelled_by_client'
  | 'cancelled_no_show';

export interface ProductIntent {
  id: string;
  client_id: string;
  product_id: string;
  variant_id: string | null;
  business_id: string;
  status: ProductIntentStatus;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface ProductIntentWithProduct extends ProductIntent {
  product_name: string;
  product_price: number | null;
}

export interface ProductIntentWithDetails extends ProductIntentWithProduct {
  client_name: string;
  client_phone: string | null;
  client_avatar_url: string | null;
}

export type ServiceIntentStatus = 'pending' | 'confirmed' | 'unavailable' | 'cancelled';

export interface ServiceIntent {
  id: string;
  client_id: string;
  service_id: string;
  business_id: string;
  status: ServiceIntentStatus;
  created_at: string;
  updated_at: string;
}

export interface ServiceIntentWithService extends ServiceIntent {
  service_name: string;
  service_price: number | null;
}
