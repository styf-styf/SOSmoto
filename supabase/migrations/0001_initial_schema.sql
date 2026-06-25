-- Enums
create type user_role as enum ('client', 'business', 'admin');
create type business_type as enum ('workshop', 'store', 'brand_advertiser');
create type employee_role as enum ('owner', 'mechanic');
create type plan_name as enum ('free', 'standard', 'pro');
create type subscription_status as enum ('active', 'expired', 'cancelled');
create type help_request_status as enum ('pending', 'accepted', 'in_progress', 'completed', 'cancelled');
create type ad_type as enum ('home_banner', 'search_featured', 'profile_ad');
create type ad_status as enum ('pending_review', 'approved', 'rejected', 'active', 'expired');
create type payment_type as enum ('subscription', 'advertising');
create type payment_status as enum ('pending', 'completed', 'failed', 'refunded');
create type moto_type as enum ('scooter', 'street', 'naked', 'enduro', 'sport', 'cruiser');
create type maintenance_suggestion_status as enum ('pending', 'notified', 'dismissed', 'completed');

-- users (extiende auth.users)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  phone text,
  full_name text not null,
  role user_role not null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- subscription_plans
create table subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name plan_name not null unique,
  max_products int,
  max_services int,
  max_photos_per_item int not null default 1,
  max_employees int,
  has_priority_matching boolean not null default false,
  has_featured_listing boolean not null default false,
  has_stories boolean not null default false,
  price_monthly numeric(10,2) not null default 0
);

-- vehicles
create table vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  brand text not null,
  model text not null,
  year int not null,
  current_mileage int not null default 0,
  last_mileage_update timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index idx_vehicles_user_id on vehicles(user_id);

-- businesses
create table businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id) on delete cascade,
  business_type business_type not null,
  name text not null,
  description text,
  logo_url text,
  address text not null,
  city text not null,
  latitude double precision not null,
  longitude double precision not null,
  phone text,
  whatsapp text,
  schedule jsonb,
  is_verified boolean not null default false,
  rating_avg numeric(3,2) not null default 0,
  followers_count int not null default 0,
  plan_id uuid not null references subscription_plans(id),
  aid_radius_km int,
  created_at timestamptz not null default now()
);
create index idx_businesses_owner_id on businesses(owner_id);
create index idx_businesses_city on businesses(city);
create index idx_businesses_location on businesses(latitude, longitude);

-- business_employees
create table business_employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role employee_role not null default 'mechanic',
  can_accept_aid_requests boolean not null default false,
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

-- business_subscriptions
create table business_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  plan_id uuid not null references subscription_plans(id),
  status subscription_status not null default 'active',
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  payment_id uuid
);
create index idx_business_subscriptions_business_id on business_subscriptions(business_id);

-- services
create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  description text,
  reference_price numeric(10,2),
  photos text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_services_business_id on services(business_id);

-- products
create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  description text,
  category text,
  reference_price numeric(10,2),
  stock int not null default 0,
  photos text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_products_business_id on products(business_id);

-- help_requests
create table help_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  vehicle_id uuid not null references vehicles(id),
  latitude double precision not null,
  longitude double precision not null,
  description text,
  status help_request_status not null default 'pending',
  accepted_business_id uuid references businesses(id),
  estimated_arrival_minutes int,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  completed_at timestamptz
);
create index idx_help_requests_client_id on help_requests(client_id);
create index idx_help_requests_status on help_requests(status);

-- help_request_notifications
create table help_request_notifications (
  id uuid primary key default gen_random_uuid(),
  help_request_id uuid not null references help_requests(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  notified_at timestamptz not null default now(),
  responded boolean not null default false,
  unique (help_request_id, business_id)
);

-- reviews
create table reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references users(id) on delete cascade,
  reviewed_business_id uuid references businesses(id) on delete cascade,
  reviewed_client_id uuid references users(id) on delete cascade,
  help_request_id uuid references help_requests(id),
  rating int not null check (rating between 1 and 5),
  comment text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint reviews_target_check check (
    (reviewed_business_id is not null and reviewed_client_id is null)
    or (reviewed_business_id is null and reviewed_client_id is not null)
  )
);
create index idx_reviews_reviewed_business_id on reviews(reviewed_business_id);
create index idx_reviews_reviewed_client_id on reviews(reviewed_client_id);

-- ads
create table ads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  type ad_type not null,
  title text not null,
  image_url text not null,
  link_url text,
  target_city text,
  status ad_status not null default 'pending_review',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  payment_id uuid,
  impressions int not null default 0,
  clicks int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_ads_business_id on ads(business_id);
create index idx_ads_status on ads(status);

-- payments
create table payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  amount numeric(10,2) not null,
  currency text not null default 'USD',
  type payment_type not null,
  gateway text not null,
  gateway_transaction_id text,
  status payment_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index idx_payments_business_id on payments(business_id);

alter table business_subscriptions
  add constraint business_subscriptions_payment_id_fkey
  foreign key (payment_id) references payments(id);

alter table ads
  add constraint ads_payment_id_fkey
  foreign key (payment_id) references payments(id);

-- maintenance_rules
create table maintenance_rules (
  id uuid primary key default gen_random_uuid(),
  moto_type moto_type not null,
  service_name text not null,
  interval_km int,
  interval_months int
);

-- maintenance_suggestions
create table maintenance_suggestions (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicles(id) on delete cascade,
  rule_id uuid not null references maintenance_rules(id),
  due_at_km int,
  status maintenance_suggestion_status not null default 'pending',
  created_at timestamptz not null default now()
);
create index idx_maintenance_suggestions_vehicle_id on maintenance_suggestions(vehicle_id);

-- follows
create table follows (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references users(id) on delete cascade,
  business_id uuid not null references businesses(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (client_id, business_id)
);
create index idx_follows_client_id on follows(client_id);
create index idx_follows_business_id on follows(business_id);

-- seed planes base
insert into subscription_plans (name, max_products, max_services, max_photos_per_item, max_employees, has_priority_matching, has_featured_listing, has_stories, price_monthly)
values
  ('free', 5, 3, 1, 1, false, false, false, 0),
  ('standard', 30, 15, 3, 3, false, false, true, 19.99),
  ('pro', null, null, 5, null, true, true, true, 49.99);
