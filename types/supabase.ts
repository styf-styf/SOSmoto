// Hand-written placeholder until this is regenerated with:
// npx supabase gen types typescript --project-id <id> > types/supabase.ts
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          full_name: string;
          role: 'client' | 'business' | 'admin';
          avatar_url: string | null;
          push_token: string | null;
          is_limited: boolean;
          limitation_reason: string | null;
          notification_prefs: Record<string, boolean>;
          legal_ack_at: string | null;
          limited_by: string | null;
          limited_at: string | null;
          created_at: string;
          last_location_country: string | null;
          last_location_region: string | null;
          last_location_city: string | null;
          last_location_updated_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          phone?: string | null;
          full_name: string;
          role: 'client' | 'business' | 'admin';
          avatar_url?: string | null;
          push_token?: string | null;
          is_limited?: boolean;
          limitation_reason?: string | null;
          notification_prefs?: Record<string, boolean>;
          legal_ack_at?: string | null;
          limited_by?: string | null;
          limited_at?: string | null;
          created_at?: string;
          last_location_country?: string | null;
          last_location_region?: string | null;
          last_location_city?: string | null;
          last_location_updated_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          phone?: string | null;
          full_name?: string;
          role?: 'client' | 'business' | 'admin';
          avatar_url?: string | null;
          push_token?: string | null;
          is_limited?: boolean;
          limitation_reason?: string | null;
          notification_prefs?: Record<string, boolean>;
          legal_ack_at?: string | null;
          limited_by?: string | null;
          limited_at?: string | null;
          created_at?: string;
          last_location_country?: string | null;
          last_location_region?: string | null;
          last_location_city?: string | null;
          last_location_updated_at?: string | null;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          user_id: string;
          brand: string;
          model: string;
          year: number;
          plate: string | null;
          current_mileage: number;
          last_mileage_update: string;
          moto_type: 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser' | null;
          avg_monthly_km: number | null;
          last_mileage_reminder_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          brand: string;
          model: string;
          year: number;
          plate?: string | null;
          current_mileage?: number;
          last_mileage_update?: string;
          moto_type?: 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser' | null;
          avg_monthly_km?: number | null;
          last_mileage_reminder_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          brand?: string;
          model?: string;
          year?: number;
          plate?: string | null;
          current_mileage?: number;
          last_mileage_update?: string;
          moto_type?: 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser' | null;
          avg_monthly_km?: number | null;
          last_mileage_reminder_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      map_loads: {
        Row: {
          id: string;
          screen: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          screen: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          screen?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      business_metric_events: {
        Row: {
          id: string;
          business_id: string;
          metric: 'product_view' | 'service_view' | 'ad_impression' | 'ad_click' | 'story_click';
          entity_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          metric: 'product_view' | 'service_view' | 'ad_impression' | 'ad_click' | 'story_click';
          entity_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          metric?: 'product_view' | 'service_view' | 'ad_impression' | 'ad_click' | 'story_click';
          entity_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          business_type: 'workshop' | 'store' | 'brand_advertiser';
          name: string;
          description: string | null;
          logo_url: string | null;
          address: string;
          city: string;
          province: string | null;
          country: string;
          latitude: number;
          longitude: number;
          phone: string | null;
          whatsapp: string | null;
          schedule: Record<string, unknown> | null;
          is_verified: boolean;
          rating_avg: number;
          followers_count: number;
          plan_id: string;
          aid_radius_km: number | null;
          is_available_for_aid: boolean;
          is_24h: boolean;
          is_limited: boolean;
          limitation_reason: string | null;
          is_deactivated: boolean;
          promotion_claimed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          business_type: 'workshop' | 'store' | 'brand_advertiser';
          name: string;
          description?: string | null;
          logo_url?: string | null;
          address: string;
          city: string;
          province?: string | null;
          country?: string;
          latitude: number;
          longitude: number;
          phone?: string | null;
          whatsapp?: string | null;
          schedule?: Record<string, unknown> | null;
          is_verified?: boolean;
          rating_avg?: number;
          followers_count?: number;
          plan_id: string;
          aid_radius_km?: number | null;
          is_available_for_aid?: boolean;
          is_24h?: boolean;
          is_limited?: boolean;
          limitation_reason?: string | null;
          is_deactivated?: boolean;
          promotion_claimed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          business_type?: 'workshop' | 'store' | 'brand_advertiser';
          name?: string;
          description?: string | null;
          logo_url?: string | null;
          address?: string;
          city?: string;
          province?: string | null;
          country?: string;
          latitude?: number;
          longitude?: number;
          phone?: string | null;
          whatsapp?: string | null;
          schedule?: Record<string, unknown> | null;
          is_verified?: boolean;
          rating_avg?: number;
          followers_count?: number;
          plan_id?: string;
          aid_radius_km?: number | null;
          is_available_for_aid?: boolean;
          is_24h?: boolean;
          is_limited?: boolean;
          limitation_reason?: string | null;
          is_deactivated?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      portfolio_photos: {
        Row: {
          id: string;
          business_id: string;
          image_url: string;
          caption: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          image_url: string;
          caption?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          image_url?: string;
          caption?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      business_employees: {
        Row: {
          id: string;
          business_id: string;
          user_id: string;
          role: 'owner' | 'mechanic';
          job_title: string | null;
          can_accept_aid_requests: boolean;
          can_manage_catalog: boolean;
          can_reply_chat: boolean;
          can_upload_stories: boolean;
          can_create_posts: boolean;
          can_view_aid_settings: boolean;
          can_view_schedule: boolean;
          can_view_agenda: boolean;
          can_view_maintenance_reminders: boolean;
          can_view_purchases: boolean;
          can_view_stats: boolean;
          can_view_growth: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role?: 'owner' | 'mechanic';
          job_title?: string | null;
          can_accept_aid_requests?: boolean;
          can_manage_catalog?: boolean;
          can_reply_chat?: boolean;
          can_upload_stories?: boolean;
          can_create_posts?: boolean;
          can_view_aid_settings?: boolean;
          can_view_schedule?: boolean;
          can_view_agenda?: boolean;
          can_view_maintenance_reminders?: boolean;
          can_view_purchases?: boolean;
          can_view_stats?: boolean;
          can_view_growth?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: 'owner' | 'mechanic';
          job_title?: string | null;
          can_accept_aid_requests?: boolean;
          can_manage_catalog?: boolean;
          can_reply_chat?: boolean;
          can_upload_stories?: boolean;
          can_create_posts?: boolean;
          can_view_aid_settings?: boolean;
          can_view_schedule?: boolean;
          can_view_agenda?: boolean;
          can_view_maintenance_reminders?: boolean;
          can_view_purchases?: boolean;
          can_view_stats?: boolean;
          can_view_growth?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_removal_notices: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          business_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          business_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      employee_invitations: {
        Row: {
          id: string;
          business_id: string;
          invitee_id: string;
          job_title: string | null;
          can_accept_aid_requests: boolean;
          can_manage_catalog: boolean;
          can_reply_chat: boolean;
          can_upload_stories: boolean;
          can_create_posts: boolean;
          can_view_aid_settings: boolean;
          can_view_schedule: boolean;
          can_view_agenda: boolean;
          can_view_maintenance_reminders: boolean;
          can_view_purchases: boolean;
          can_view_stats: boolean;
          can_view_growth: boolean;
          status: 'pending' | 'accepted' | 'rejected';
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          invitee_id: string;
          job_title?: string | null;
          can_accept_aid_requests?: boolean;
          can_manage_catalog?: boolean;
          can_reply_chat?: boolean;
          can_upload_stories?: boolean;
          can_create_posts?: boolean;
          can_view_aid_settings?: boolean;
          can_view_schedule?: boolean;
          can_view_agenda?: boolean;
          can_view_maintenance_reminders?: boolean;
          can_view_purchases?: boolean;
          can_view_stats?: boolean;
          can_view_growth?: boolean;
          status?: 'pending' | 'accepted' | 'rejected';
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          invitee_id?: string;
          job_title?: string | null;
          can_accept_aid_requests?: boolean;
          can_manage_catalog?: boolean;
          can_reply_chat?: boolean;
          can_upload_stories?: boolean;
          can_create_posts?: boolean;
          can_view_aid_settings?: boolean;
          can_view_schedule?: boolean;
          can_view_agenda?: boolean;
          can_view_maintenance_reminders?: boolean;
          can_view_purchases?: boolean;
          can_view_stats?: boolean;
          can_view_growth?: boolean;
          status?: 'pending' | 'accepted' | 'rejected';
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          name: 'free' | 'standard' | 'pro';
          business_type: 'workshop' | 'store' | 'brand_advertiser';
          max_products: number | null;
          max_services: number | null;
          max_photos_per_item: number;
          max_employees: number | null;
          has_priority_matching: boolean;
          has_featured_listing: boolean;
          max_active_stories: number | null;
          allow_variants: boolean;
          allow_price_tiers: boolean;
          price_monthly: number;
        };
        Insert: {
          id?: string;
          name: 'free' | 'standard' | 'pro';
          business_type?: 'workshop' | 'store' | 'brand_advertiser';
          max_products?: number | null;
          max_services?: number | null;
          max_photos_per_item?: number;
          max_employees?: number | null;
          has_priority_matching?: boolean;
          has_featured_listing?: boolean;
          max_active_stories?: number | null;
          allow_variants?: boolean;
          allow_price_tiers?: boolean;
          price_monthly?: number;
        };
        Update: {
          id?: string;
          name?: 'free' | 'standard' | 'pro';
          business_type?: 'workshop' | 'store' | 'brand_advertiser';
          max_products?: number | null;
          max_services?: number | null;
          max_photos_per_item?: number;
          max_employees?: number | null;
          has_priority_matching?: boolean;
          has_featured_listing?: boolean;
          max_active_stories?: number | null;
          allow_variants?: boolean;
          allow_price_tiers?: boolean;
          price_monthly?: number;
        };
        Relationships: [];
      };
      business_subscriptions: {
        Row: {
          id: string;
          business_id: string;
          plan_id: string;
          status: 'active' | 'expired' | 'cancelled';
          started_at: string;
          expires_at: string | null;
          payment_id: string | null;
          promotion_id: string | null;
          reminder_sent_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          plan_id: string;
          status?: 'active' | 'expired' | 'cancelled';
          started_at?: string;
          expires_at?: string | null;
          payment_id?: string | null;
          promotion_id?: string | null;
          reminder_sent_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          plan_id?: string;
          status?: 'active' | 'expired' | 'cancelled';
          started_at?: string;
          expires_at?: string | null;
          payment_id?: string | null;
          promotion_id?: string | null;
          reminder_sent_at?: string | null;
        };
        Relationships: [];
      };
      plan_promotions: {
        Row: {
          id: string;
          plan_id: string;
          duration_days: number;
          remaining_days: number;
          window_days: number | null;
          remaining_window_days: number | null;
          label_text: string | null;
          is_active: boolean;
          activated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          duration_days: number;
          remaining_days?: number;
          window_days?: number | null;
          remaining_window_days?: number | null;
          label_text?: string | null;
          is_active?: boolean;
          activated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          duration_days?: number;
          remaining_days?: number;
          window_days?: number | null;
          remaining_window_days?: number | null;
          label_text?: string | null;
          is_active?: boolean;
          activated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
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
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          category_id: string;
          reference_price?: number | null;
          photos?: string[];
          is_active?: boolean;
          views?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          category_id?: string;
          reference_price?: number | null;
          photos?: string[];
          is_active?: boolean;
          views?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
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
          min_order_quantity: number | null;
          price_tiers: { min_quantity: number; unit_price: number }[] | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          category_id: string;
          reference_price?: number | null;
          stock?: number;
          photos?: string[];
          is_active?: boolean;
          views?: number;
          created_at?: string;
          min_order_quantity?: number | null;
          price_tiers?: { min_quantity: number; unit_price: number }[] | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          category_id?: string;
          reference_price?: number | null;
          stock?: number;
          photos?: string[];
          is_active?: boolean;
          views?: number;
          created_at?: string;
          min_order_quantity?: number | null;
          price_tiers?: { min_quantity: number; unit_price: number }[] | null;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          label: string;
          stock: number;
          reference_price: number | null;
          is_active: boolean;
          created_at: string;
          price_tiers: { min_quantity: number; unit_price: number }[] | null;
        };
        Insert: {
          id?: string;
          product_id: string;
          label: string;
          stock?: number;
          reference_price?: number | null;
          is_active?: boolean;
          created_at?: string;
          price_tiers?: { min_quantity: number; unit_price: number }[] | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          label?: string;
          stock?: number;
          reference_price?: number | null;
          is_active?: boolean;
          created_at?: string;
          price_tiers?: { min_quantity: number; unit_price: number }[] | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          name: string;
          kind: 'product' | 'service';
          status: 'approved' | 'pending';
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          kind: 'product' | 'service';
          status?: 'approved' | 'pending';
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          kind?: 'product' | 'service';
          status?: 'approved' | 'pending';
          created_at?: string;
        };
        Relationships: [];
      };
      help_requests: {
        Row: {
          id: string;
          client_id: string;
          vehicle_id: string;
          latitude: number;
          longitude: number;
          description: string | null;
          status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
          accepted_business_id: string | null;
          estimated_arrival_minutes: number | null;
          business_latitude: number | null;
          business_longitude: number | null;
          business_location_updated_at: string | null;
          created_at: string;
          accepted_at: string | null;
          completed_at: string | null;
          admin_notes: string | null;
          dispute_status: 'none' | 'flagged' | 'reviewed';
        };
        Insert: {
          id?: string;
          client_id: string;
          vehicle_id: string;
          latitude: number;
          longitude: number;
          description?: string | null;
          status?: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
          accepted_business_id?: string | null;
          estimated_arrival_minutes?: number | null;
          business_latitude?: number | null;
          business_longitude?: number | null;
          business_location_updated_at?: string | null;
          created_at?: string;
          accepted_at?: string | null;
          completed_at?: string | null;
          admin_notes?: string | null;
          dispute_status?: 'none' | 'flagged' | 'reviewed';
        };
        Update: {
          id?: string;
          client_id?: string;
          vehicle_id?: string;
          latitude?: number;
          longitude?: number;
          description?: string | null;
          status?: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
          accepted_business_id?: string | null;
          estimated_arrival_minutes?: number | null;
          business_latitude?: number | null;
          business_longitude?: number | null;
          business_location_updated_at?: string | null;
          created_at?: string;
          accepted_at?: string | null;
          completed_at?: string | null;
          admin_notes?: string | null;
          dispute_status?: 'none' | 'flagged' | 'reviewed';
        };
        Relationships: [];
      };
      help_request_notifications: {
        Row: {
          id: string;
          help_request_id: string;
          business_id: string;
          notified_at: string;
          responded: boolean;
          out_of_range: boolean;
        };
        Insert: {
          id?: string;
          help_request_id: string;
          business_id: string;
          notified_at?: string;
          responded?: boolean;
          out_of_range?: boolean;
        };
        Update: {
          id?: string;
          help_request_id?: string;
          business_id?: string;
          notified_at?: string;
          responded?: boolean;
          out_of_range?: boolean;
        };
        Relationships: [];
      };
      growth_suggestions: {
        Row: {
          id: string;
          business_id: string;
          type: 'upgrade_plan_limit_reached' | 'upgrade_plan_near_limit' | 'advertise_low_visibility' | 'advertise_new_business';
          title: string;
          body: string;
          status: 'active' | 'dismissed';
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          type: 'upgrade_plan_limit_reached' | 'upgrade_plan_near_limit' | 'advertise_low_visibility' | 'advertise_new_business';
          title: string;
          body: string;
          status?: 'active' | 'dismissed';
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          type?: 'upgrade_plan_limit_reached' | 'upgrade_plan_near_limit' | 'advertise_low_visibility' | 'advertise_new_business';
          title?: string;
          body?: string;
          status?: 'active' | 'dismissed';
          created_at?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
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
        };
        Insert: {
          id?: string;
          reviewer_id: string;
          reviewed_business_id?: string | null;
          reviewed_client_id?: string | null;
          help_request_id?: string | null;
          appointment_id?: string | null;
          product_intent_id?: string | null;
          rating: number;
          comment?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          reviewer_id?: string;
          reviewed_business_id?: string | null;
          reviewed_client_id?: string | null;
          help_request_id?: string | null;
          appointment_id?: string | null;
          product_intent_id?: string | null;
          rating?: number;
          comment?: string | null;
          is_public?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      ads: {
        Row: {
          id: string;
          business_id: string;
          kind: 'product' | 'service';
          category_id: string | null;
          item_name: string;
          product_id: string | null;
          service_id: string | null;
          title: string;
          photos: string[];
          link_url: string | null;
          link_label: string | null;
          target_city: string | null;
          target_scope: 'national' | 'city' | 'radius';
          target_lat: number | null;
          target_lng: number | null;
          target_radius_km: number | null;
          status: 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired' | 'paused';
          starts_at: string;
          ends_at: string;
          paused_at: string | null;
          payment_id: string | null;
          impressions: number;
          clicks: number;
          comments_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          kind?: 'product' | 'service';
          category_id?: string | null;
          item_name: string;
          product_id?: string | null;
          service_id?: string | null;
          title: string;
          photos?: string[];
          link_url?: string | null;
          link_label?: string | null;
          target_city?: string | null;
          target_scope?: 'national' | 'city' | 'radius';
          target_lat?: number | null;
          target_lng?: number | null;
          target_radius_km?: number | null;
          status?: 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired' | 'paused';
          starts_at: string;
          ends_at: string;
          paused_at?: string | null;
          payment_id?: string | null;
          impressions?: number;
          clicks?: number;
          comments_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          kind?: 'product' | 'service';
          category_id?: string | null;
          item_name?: string;
          product_id?: string | null;
          service_id?: string | null;
          title?: string;
          photos?: string[];
          link_url?: string | null;
          link_label?: string | null;
          target_city?: string | null;
          target_scope?: 'national' | 'city' | 'radius';
          target_lat?: number | null;
          target_lng?: number | null;
          target_radius_km?: number | null;
          status?: 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired' | 'paused';
          starts_at?: string;
          ends_at?: string;
          paused_at?: string | null;
          payment_id?: string | null;
          impressions?: number;
          clicks?: number;
          comments_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      ad_pricing: {
        Row: {
          id: boolean;
          price_per_day_city: number;
          price_per_day_national: number;
          radius_reference_km: number;
          radius_cap_km: number;
        };
        Insert: {
          id?: boolean;
          price_per_day_city?: number;
          price_per_day_national?: number;
          radius_reference_km?: number;
          radius_cap_km?: number;
        };
        Update: {
          id?: boolean;
          price_per_day_city?: number;
          price_per_day_national?: number;
          radius_reference_km?: number;
          radius_cap_km?: number;
        };
        Relationships: [];
      };
      ad_comments: {
        Row: {
          id: string;
          ad_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ad_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          ad_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      stories: {
        Row: {
          id: string;
          business_id: string | null;
          client_id: string | null;
          image_url: string;
          caption: string | null;
          action_type: 'service' | 'product' | 'contact' | 'business_tag' | 'none';
          action_target_id: string | null;
          is_pinned: boolean;
          views: number;
          clicks: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id?: string | null;
          client_id?: string | null;
          image_url: string;
          caption?: string | null;
          action_type?: 'service' | 'product' | 'contact' | 'business_tag' | 'none';
          action_target_id?: string | null;
          is_pinned?: boolean;
          views?: number;
          clicks?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string | null;
          client_id?: string | null;
          image_url?: string;
          caption?: string | null;
          action_type?: 'service' | 'product' | 'contact' | 'business_tag' | 'none';
          action_target_id?: string | null;
          is_pinned?: boolean;
          views?: number;
          clicks?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      story_views: {
        Row: {
          story_id: string;
          client_id: string;
          viewed_at: string;
        };
        Insert: {
          story_id: string;
          client_id: string;
          viewed_at?: string;
        };
        Update: {
          story_id?: string;
          client_id?: string;
          viewed_at?: string;
        };
        Relationships: [];
      };
      posts: {
        Row: {
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
        };
        Insert: {
          id?: string;
          business_id?: string | null;
          client_id?: string | null;
          photos?: string[];
          caption?: string | null;
          tag_business_id?: string | null;
          tag_client_id?: string | null;
          tag_service_id?: string | null;
          tag_product_id?: string | null;
          comments_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string | null;
          client_id?: string | null;
          photos?: string[];
          caption?: string | null;
          tag_business_id?: string | null;
          tag_client_id?: string | null;
          tag_service_id?: string | null;
          tag_product_id?: string | null;
          comments_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      post_comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          business_id: string;
          amount: number;
          currency: string;
          type: 'subscription' | 'advertising';
          gateway: string;
          gateway_transaction_id: string | null;
          client_transaction_id: string | null;
          payphone_transaction_id: string | null;
          plan_id: string | null;
          status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          amount: number;
          currency?: string;
          type: 'subscription' | 'advertising';
          gateway: string;
          gateway_transaction_id?: string | null;
          client_transaction_id?: string | null;
          payphone_transaction_id?: string | null;
          plan_id?: string | null;
          status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          amount?: number;
          currency?: string;
          type?: 'subscription' | 'advertising';
          gateway?: string;
          gateway_transaction_id?: string | null;
          client_transaction_id?: string | null;
          payphone_transaction_id?: string | null;
          plan_id?: string | null;
          status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled';
          created_at?: string;
        };
        Relationships: [];
      };
      maintenance_rules: {
        Row: {
          id: string;
          moto_type: 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser';
          service_name: string;
          interval_km: number | null;
          interval_months: number | null;
        };
        Insert: {
          id?: string;
          moto_type: 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser';
          service_name: string;
          interval_km?: number | null;
          interval_months?: number | null;
        };
        Update: {
          id?: string;
          moto_type?: 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser';
          service_name?: string;
          interval_km?: number | null;
          interval_months?: number | null;
        };
        Relationships: [];
      };
      maintenance_suggestions: {
        Row: {
          id: string;
          vehicle_id: string;
          rule_id: string;
          due_at_km: number | null;
          status: 'pending' | 'notified' | 'dismissed' | 'completed';
          overdue_notified_at: string | null;
          completed_at: string | null;
          completed_at_km: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          rule_id: string;
          due_at_km?: number | null;
          status?: 'pending' | 'notified' | 'dismissed' | 'completed';
          overdue_notified_at?: string | null;
          completed_at?: string | null;
          completed_at_km?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          rule_id?: string;
          due_at_km?: number | null;
          status?: 'pending' | 'notified' | 'dismissed' | 'completed';
          overdue_notified_at?: string | null;
          completed_at?: string | null;
          completed_at_km?: number | null;
          created_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          client_id: string;
          business_id: string;
          sender_id: string;
          body: string;
          image_url: string | null;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          business_id: string;
          sender_id: string;
          body: string;
          image_url?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          business_id?: string;
          sender_id?: string;
          body?: string;
          image_url?: string | null;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          client_id: string | null;
          business_id: string;
          vehicle_id: string | null;
          service_id: string | null;
          service_name: string | null;
          requested_at: string | null;
          proposed_by: 'client' | 'business' | null;
          notes: string | null;
          status: 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
          external_client_name: string | null;
          external_client_phone: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          business_id: string;
          vehicle_id?: string | null;
          service_id?: string | null;
          service_name?: string | null;
          requested_at?: string | null;
          proposed_by?: 'client' | 'business' | null;
          notes?: string | null;
          status?: 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
          external_client_name?: string | null;
          external_client_phone?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          business_id?: string;
          vehicle_id?: string | null;
          service_id?: string | null;
          service_name?: string | null;
          requested_at?: string | null;
          proposed_by?: 'client' | 'business' | null;
          notes?: string | null;
          status?: 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
          external_client_name?: string | null;
          external_client_phone?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      appointment_requests: {
        Row: {
          id: string;
          client_id: string;
          business_id: string;
          service_id: string | null;
          vehicle_id: string | null;
          service_name: string | null;
          vehicle_label: string | null;
          notes: string | null;
          suggested_at: string | null;
          status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          business_id: string;
          service_id?: string | null;
          vehicle_id?: string | null;
          service_name?: string | null;
          vehicle_label?: string | null;
          notes?: string | null;
          suggested_at?: string | null;
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          business_id?: string;
          service_id?: string | null;
          vehicle_id?: string | null;
          service_name?: string | null;
          vehicle_label?: string | null;
          notes?: string | null;
          suggested_at?: string | null;
          status?: 'pending' | 'accepted' | 'rejected' | 'cancelled';
          created_at?: string;
        };
        Relationships: [];
      };
      business_clients: {
        Row: {
          id: string;
          business_id: string;
          client_id: string | null;
          external_name: string | null;
          external_phone: string | null;
          external_email: string | null;
          vehicles: unknown;
          notes: string | null;
          status: 'pending' | 'accepted' | 'rejected';
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_id?: string | null;
          external_name?: string | null;
          external_phone?: string | null;
          external_email?: string | null;
          vehicles?: unknown;
          notes?: string | null;
          status?: 'pending' | 'accepted' | 'rejected';
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          client_id?: string | null;
          external_name?: string | null;
          external_phone?: string | null;
          external_email?: string | null;
          vehicles?: unknown;
          notes?: string | null;
          status?: 'pending' | 'accepted' | 'rejected';
          created_at?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          variant_id: string | null;
          business_id: string;
          delta: number;
          reason: 'entry' | 'sale' | 'adjustment' | 'damage' | 'other';
          notes: string | null;
          client_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          variant_id?: string | null;
          business_id: string;
          delta: number;
          reason: 'entry' | 'sale' | 'adjustment' | 'damage' | 'other';
          notes?: string | null;
          client_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          variant_id?: string | null;
          business_id?: string;
          delta?: number;
          reason?: 'entry' | 'sale' | 'adjustment' | 'damage' | 'other';
          notes?: string | null;
          client_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      system_settings: {
        Row: {
          id: boolean;
          default_aid_radius_km: number;
        };
        Insert: {
          id?: boolean;
          default_aid_radius_km?: number;
        };
        Update: {
          id?: boolean;
          default_aid_radius_km?: number;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string;
          target_type: 'post' | 'review' | 'business' | 'product' | 'service' | 'comment';
          target_id: string;
          reason: string | null;
          status: 'pending' | 'reviewed' | 'dismissed';
          created_at: string;
        };
        Insert: {
          id?: string;
          reporter_id: string;
          target_type: 'post' | 'review' | 'business' | 'product' | 'service' | 'comment';
          target_id: string;
          reason?: string | null;
          status?: 'pending' | 'reviewed' | 'dismissed';
          created_at?: string;
        };
        Update: {
          id?: string;
          reporter_id?: string;
          target_type?: 'post' | 'review' | 'business' | 'product' | 'service' | 'comment';
          target_id?: string;
          reason?: string | null;
          status?: 'pending' | 'reviewed' | 'dismissed';
          created_at?: string;
        };
        Relationships: [];
      };
      pilot_feedback: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          message: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          id: string;
          client_id: string;
          business_id: string;
          follower_business_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          business_id: string;
          follower_business_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          business_id?: string;
          follower_business_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      product_intents: {
        Row: {
          id: string;
          client_id: string;
          product_id: string | null;
          variant_id: string | null;
          business_id: string;
          status: 'pending' | 'confirmed' | 'sold' | 'unavailable' | 'cancelled_by_client' | 'cancelled_no_show';
          quantity: number;
          product_name: string | null;
          product_price: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          product_id?: string | null;
          variant_id?: string | null;
          business_id: string;
          status?: 'pending' | 'confirmed' | 'sold' | 'unavailable' | 'cancelled_by_client' | 'cancelled_no_show';
          quantity?: number;
          product_name?: string | null;
          product_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          product_id?: string | null;
          variant_id?: string | null;
          business_id?: string;
          status?: 'pending' | 'confirmed' | 'sold' | 'unavailable' | 'cancelled_by_client' | 'cancelled_no_show';
          quantity?: number;
          product_name?: string | null;
          product_price?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_intents: {
        Row: {
          id: string;
          client_id: string;
          service_id: string;
          business_id: string;
          status: 'pending' | 'confirmed' | 'unavailable' | 'cancelled';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          service_id: string;
          business_id: string;
          status?: 'pending' | 'confirmed' | 'unavailable' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          service_id?: string;
          business_id?: string;
          status?: 'pending' | 'confirmed' | 'unavailable' | 'cancelled';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      business_verification_requests: {
        Row: {
          id: string;
          business_id: string;
          id_document_path: string;
          ruc_document_path: string | null;
          storefront_photo_path: string;
          notes: string | null;
          status: 'pending_review' | 'approved' | 'rejected';
          admin_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          id_document_path: string;
          ruc_document_path?: string | null;
          storefront_photo_path: string;
          notes?: string | null;
          status?: 'pending_review' | 'approved' | 'rejected';
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          id_document_path?: string;
          ruc_document_path?: string | null;
          storefront_photo_path?: string;
          notes?: string | null;
          status?: 'pending_review' | 'approved' | 'rejected';
          admin_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          data: Record<string, unknown> | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          data?: Record<string, unknown> | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          data?: Record<string, unknown> | null;
          read?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      legal_documents: {
        Row: {
          id: string;
          type: 'terms' | 'privacy';
          version: number;
          content: string;
          published_at: string;
          published_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'terms' | 'privacy';
          version: number;
          content: string;
          published_at?: string;
          published_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: 'terms' | 'privacy';
          version?: number;
          content?: string;
          published_at?: string;
          published_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      service_reports: {
        Row: {
          id: string;
          business_id: string;
          client_id: string | null;
          appointment_id: string | null;
          help_request_id: string | null;
          vehicle_id: string | null;
          vehicle_label: string | null;
          external_client_name: string | null;
          service_category: string | null;
          service_km: number | null;
          services_performed: string[];
          parts_used: Record<string, unknown> | null;
          inspection_checklist: Record<string, unknown> | null;
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
        };
        Insert: {
          id?: string;
          business_id: string;
          client_id?: string | null;
          appointment_id?: string | null;
          help_request_id?: string | null;
          vehicle_id?: string | null;
          vehicle_label?: string | null;
          external_client_name?: string | null;
          service_category?: string | null;
          service_km?: number | null;
          services_performed?: string[];
          parts_used?: Record<string, unknown> | null;
          inspection_checklist?: Record<string, unknown> | null;
          observations?: string | null;
          recommendations?: string | null;
          vehicle_plate?: string | null;
          entry_date?: string | null;
          exit_date?: string | null;
          next_maintenance_km?: number | null;
          next_maintenance_date?: string | null;
          client_confirmed_at?: string | null;
          status?: 'draft' | 'sent';
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          client_id?: string | null;
          appointment_id?: string | null;
          help_request_id?: string | null;
          vehicle_id?: string | null;
          vehicle_label?: string | null;
          external_client_name?: string | null;
          service_category?: string | null;
          service_km?: number | null;
          services_performed?: string[];
          parts_used?: Record<string, unknown> | null;
          inspection_checklist?: Record<string, unknown> | null;
          observations?: string | null;
          recommendations?: string | null;
          vehicle_plate?: string | null;
          entry_date?: string | null;
          exit_date?: string | null;
          next_maintenance_km?: number | null;
          next_maintenance_date?: string | null;
          client_confirmed_at?: string | null;
          status?: 'draft' | 'sent';
          created_at?: string;
        };
        Relationships: [];
      };
      ai_chat_messages: {
        Row: {
          id: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          action: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: 'user' | 'assistant';
          content: string;
          action?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: 'user' | 'assistant';
          content?: string;
          action?: Record<string, unknown> | null;
          created_at?: string;
        };
        Relationships: [];
      };
      account_deletion_requests: {
        Row: {
          id: string;
          user_id: string;
          reason: string | null;
          status: 'pending' | 'cancelled' | 'completed';
          requested_at: string;
          scheduled_for: string;
          cancelled_at: string | null;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          reason?: string | null;
          status?: 'pending' | 'cancelled' | 'completed';
          requested_at?: string;
          scheduled_for?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          reason?: string | null;
          status?: 'pending' | 'cancelled' | 'completed';
          requested_at?: string;
          scheduled_for?: string;
          cancelled_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      hidden_chats: {
        Row: {
          id: string;
          client_id: string;
          business_id: string;
          hidden_by: 'client' | 'business';
          hidden_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          business_id: string;
          hidden_by: 'client' | 'business';
          hidden_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          business_id?: string;
          hidden_by?: 'client' | 'business';
          hidden_at?: string;
        };
        Relationships: [];
      };
      chat_quotes: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          kind: 'product' | 'service';
          label: string;
          product_id: string | null;
          variant_id: string | null;
          quantity: number | null;
          service_id: string | null;
          unit_price: number | null;
          status: 'pending' | 'resolved' | 'cancelled' | 'dismissed';
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_id: string;
          kind: 'product' | 'service';
          label: string;
          product_id?: string | null;
          variant_id?: string | null;
          quantity?: number | null;
          service_id?: string | null;
          unit_price?: number | null;
          status?: 'pending' | 'resolved' | 'cancelled' | 'dismissed';
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          client_id?: string;
          kind?: 'product' | 'service';
          label?: string;
          product_id?: string | null;
          variant_id?: string | null;
          quantity?: number | null;
          service_id?: string | null;
          unit_price?: number | null;
          status?: 'pending' | 'resolved' | 'cancelled' | 'dismissed';
          created_at?: string;
        };
        Relationships: [];
      };
      hidden_chat_banners: {
        Row: {
          id: string;
          business_id: string;
          client_id: string;
          banner_key: string;
          hidden_by: 'client' | 'business';
          hidden_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          client_id: string;
          banner_key: string;
          hidden_by: 'client' | 'business';
          hidden_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          client_id?: string;
          banner_key?: string;
          hidden_by?: 'client' | 'business';
          hidden_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      public_profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
        };
        Relationships: [];
      };
      businesses_public: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          logo_url: string | null;
          address: string;
          city: string;
          latitude: number;
          longitude: number;
          whatsapp: string | null;
          schedule: Record<string, unknown> | null;
          is_verified: boolean;
          rating_avg: number;
          followers_count: number;
          plan_id: string;
          aid_radius_km: number | null;
          business_type: 'workshop' | 'store' | 'brand_advertiser';
          is_deactivated: boolean;
          is_available_for_aid: boolean;
          is_24h: boolean;
          province: string | null;
          created_at: string;
          country: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      find_user_id_by_email: {
        Args: { target_email: string };
        Returns: { id: string; role: 'client' | 'business' | 'admin' }[];
      };
      get_client_conversations: {
        Args: { target_client_id: string };
        Returns: {
          business_id: string;
          body: string | null;
          image_url: string | null;
          created_at: string;
          sender_id: string;
          read_at: string | null;
        }[];
      };
      get_business_conversations: {
        Args: { target_business_id: string };
        Returns: {
          client_id: string;
          body: string | null;
          image_url: string | null;
          created_at: string;
          sender_id: string;
          read_at: string | null;
        }[];
      };
      get_business_employees: {
        Args: { target_business_id: string };
        Returns: {
          id: string;
          business_id: string;
          user_id: string;
          role: 'owner' | 'mechanic';
          job_title: string | null;
          can_accept_aid_requests: boolean;
          can_manage_catalog: boolean;
          can_reply_chat: boolean;
          can_upload_stories: boolean;
          can_create_posts: boolean;
          can_view_aid_settings: boolean;
          can_view_schedule: boolean;
          can_view_agenda: boolean;
          can_view_maintenance_reminders: boolean;
          can_view_purchases: boolean;
          can_view_stats: boolean;
          can_view_growth: boolean;
          created_at: string;
          full_name: string;
          email: string;
          phone: string | null;
        }[];
      };
      claim_plan_promotion: {
        Args: { target_business_id: string };
        Returns: {
          id: string;
          business_id: string;
          plan_id: string;
          status: 'active' | 'expired' | 'cancelled';
          started_at: string;
          expires_at: string | null;
          payment_id: string | null;
          promotion_id: string | null;
          reminder_sent_at: string | null;
        };
      };
      get_active_plan_promotion: {
        Args: { target_business_type?: string | null };
        Returns: {
          id: string;
          plan_id: string;
          plan_name: 'free' | 'standard' | 'pro';
          duration_days: number;
          activated_at: string;
          applies_to_all_businesses: boolean;
          label_text: string | null;
          remaining_window_days: number | null;
        }[];
      };
      log_map_load: {
        Args: { p_screen: string };
        Returns: undefined;
      };
      increment_ad_metric: {
        Args: { ad_id: string; metric: string };
        Returns: undefined;
      };
      increment_story_metric: {
        Args: { story_id: string; metric: string };
        Returns: undefined;
      };
      increment_catalog_views: {
        Args: { item_id: string; item_type: string };
        Returns: undefined;
      };
      change_role_to_client: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      search_clients_by_name: {
        Args: { search_query: string };
        Returns: { id: string; full_name: string; phone: string | null; avatar_url: string | null }[];
      };
      get_pending_client_names: {
        Args: { target_client_ids: string[] };
        Returns: { id: string; full_name: string; avatar_url: string | null }[];
      };
      get_business_ad_metrics: {
        Args: { target_business_id: string };
        Returns: { total_impressions: number; total_clicks: number }[];
      };
      get_push_token_for_notify: {
        Args: { p_target_user_id: string };
        Returns: string | null;
      };
      get_business_ads_with_metrics: {
        Args: { target_business_id: string };
        Returns: unknown[];
      };
      get_business_owner_for_notify: {
        Args: { target_business_id: string };
        Returns: string | null;
      };
      resolve_owned_businesses: {
        Args: { target_ids: string[] };
        Returns: { id: string; owner_id: string; name: string; logo_url: string | null; is_verified: boolean }[];
      };
      get_business_owner_for_chat: {
        Args: { target_business_id: string };
        Returns: string | null;
      };
      get_business_phone_for_client: {
        Args: { target_business_id: string };
        Returns: string | null;
      };
      increment_post_shares: {
        Args: { post_id: string };
        Returns: undefined;
      };
      create_product_intent_by_business: {
        Args: { p_client_id: string; p_product_id: string; p_variant_id: string | null; p_quantity: number };
        Returns: {
          id: string;
          client_id: string;
          product_id: string;
          variant_id: string | null;
          business_id: string;
          status: string;
          quantity: number;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}
