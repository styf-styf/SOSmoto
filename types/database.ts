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

export interface Vehicle {
  id: string;
  user_id: string;
  brand: string;
  model: string;
  year: number;
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
  is_24h: boolean;
  is_limited: boolean;
  limitation_reason: string | null;
  created_at: string;
}

export type EmployeeRole = 'owner' | 'mechanic';

export interface BusinessEmployee {
  id: string;
  business_id: string;
  user_id: string;
  role: EmployeeRole;
  can_accept_aid_requests: boolean;
  created_at: string;
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
  reminder_sent_at: string | null;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
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
  category: string | null;
  reference_price: number | null;
  stock: number;
  photos: string[];
  is_active: boolean;
  views: number;
  created_at: string;
}

export type HelpRequestStatus =
  | 'pending'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

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
  image_url: string | null;
  caption: string | null;
  tag_business_id: string | null;
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
  created_at: string;
  read_at: string | null;
}

export type AppointmentStatus = 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';

export interface Appointment {
  id: string;
  client_id: string;
  business_id: string;
  vehicle_id: string | null;
  service_id: string | null;
  requested_at: string | null;
  notes: string | null;
  status: AppointmentStatus;
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
