export type UserRole = 'client' | 'business' | 'admin';

export interface User {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
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
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  reference_price: number | null;
  photos: string[];
  is_active: boolean;
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
}

export interface Review {
  id: string;
  reviewer_id: string;
  reviewed_business_id: string | null;
  reviewed_client_id: string | null;
  help_request_id: string | null;
  rating: number;
  comment: string | null;
  is_public: boolean;
  created_at: string;
}

export type AdType = 'home_banner' | 'search_featured' | 'profile_ad';
export type AdStatus = 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';

export interface Ad {
  id: string;
  business_id: string;
  type: AdType;
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
  status: PaymentStatus;
  created_at: string;
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
  created_at: string;
}

export interface Follow {
  id: string;
  client_id: string;
  business_id: string;
  created_at: string;
}
