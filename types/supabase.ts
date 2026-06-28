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
          created_at: string;
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
          created_at?: string;
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
          created_at?: string;
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
          current_mileage?: number;
          last_mileage_update?: string;
          moto_type?: 'scooter' | 'street' | 'naked' | 'enduro' | 'sport' | 'cruiser' | null;
          avg_monthly_km?: number | null;
          last_mileage_reminder_at?: string | null;
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
          is_24h: boolean;
          is_limited: boolean;
          limitation_reason: string | null;
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
          is_24h?: boolean;
          is_limited?: boolean;
          limitation_reason?: string | null;
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
          is_24h?: boolean;
          is_limited?: boolean;
          limitation_reason?: string | null;
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
          can_accept_aid_requests: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          user_id: string;
          role?: 'owner' | 'mechanic';
          can_accept_aid_requests?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          user_id?: string;
          role?: 'owner' | 'mechanic';
          can_accept_aid_requests?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      subscription_plans: {
        Row: {
          id: string;
          name: 'free' | 'standard' | 'pro';
          max_products: number | null;
          max_services: number | null;
          max_photos_per_item: number;
          max_employees: number | null;
          has_priority_matching: boolean;
          has_featured_listing: boolean;
          has_stories: boolean;
          price_monthly: number;
        };
        Insert: {
          id?: string;
          name: 'free' | 'standard' | 'pro';
          max_products?: number | null;
          max_services?: number | null;
          max_photos_per_item?: number;
          max_employees?: number | null;
          has_priority_matching?: boolean;
          has_featured_listing?: boolean;
          has_stories?: boolean;
          price_monthly?: number;
        };
        Update: {
          id?: string;
          name?: 'free' | 'standard' | 'pro';
          max_products?: number | null;
          max_services?: number | null;
          max_photos_per_item?: number;
          max_employees?: number | null;
          has_priority_matching?: boolean;
          has_featured_listing?: boolean;
          has_stories?: boolean;
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
          reminder_sent_at?: string | null;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          reference_price: number | null;
          photos: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          reference_price?: number | null;
          photos?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          reference_price?: number | null;
          photos?: string[];
          is_active?: boolean;
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
          category: string | null;
          reference_price: number | null;
          stock: number;
          photos: string[];
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          category?: string | null;
          reference_price?: number | null;
          stock?: number;
          photos?: string[];
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          reference_price?: number | null;
          stock?: number;
          photos?: string[];
          is_active?: boolean;
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
        };
        Insert: {
          id?: string;
          help_request_id: string;
          business_id: string;
          notified_at?: string;
          responded?: boolean;
        };
        Update: {
          id?: string;
          help_request_id?: string;
          business_id?: string;
          notified_at?: string;
          responded?: boolean;
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
          title: string;
          image_url: string;
          link_url: string | null;
          target_city: string | null;
          status: 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';
          starts_at: string;
          ends_at: string;
          payment_id: string | null;
          impressions: number;
          clicks: number;
          comments_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          title: string;
          image_url: string;
          link_url?: string | null;
          target_city?: string | null;
          status?: 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';
          starts_at: string;
          ends_at: string;
          payment_id?: string | null;
          impressions?: number;
          clicks?: number;
          comments_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          title?: string;
          image_url?: string;
          link_url?: string | null;
          target_city?: string | null;
          status?: 'pending_review' | 'approved' | 'rejected' | 'active' | 'expired';
          starts_at?: string;
          ends_at?: string;
          payment_id?: string | null;
          impressions?: number;
          clicks?: number;
          comments_count?: number;
          created_at?: string;
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
          image_url: string | null;
          caption: string | null;
          tag_business_id: string | null;
          tag_service_id: string | null;
          tag_product_id: string | null;
          comments_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id?: string | null;
          client_id?: string | null;
          image_url?: string | null;
          caption?: string | null;
          tag_business_id?: string | null;
          tag_service_id?: string | null;
          tag_product_id?: string | null;
          comments_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string | null;
          client_id?: string | null;
          image_url?: string | null;
          caption?: string | null;
          tag_business_id?: string | null;
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
          plan_id: string | null;
          status: 'pending' | 'completed' | 'failed' | 'refunded';
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
          plan_id?: string | null;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
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
          plan_id?: string | null;
          status?: 'pending' | 'completed' | 'failed' | 'refunded';
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
          created_at: string;
        };
        Insert: {
          id?: string;
          vehicle_id: string;
          rule_id: string;
          due_at_km?: number | null;
          status?: 'pending' | 'notified' | 'dismissed' | 'completed';
          overdue_notified_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          vehicle_id?: string;
          rule_id?: string;
          due_at_km?: number | null;
          status?: 'pending' | 'notified' | 'dismissed' | 'completed';
          overdue_notified_at?: string | null;
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
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          client_id: string;
          business_id: string;
          sender_id: string;
          body: string;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          client_id?: string;
          business_id?: string;
          sender_id?: string;
          body?: string;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      appointments: {
        Row: {
          id: string;
          client_id: string;
          business_id: string;
          vehicle_id: string | null;
          service_id: string | null;
          requested_at: string | null;
          notes: string | null;
          status: 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          business_id: string;
          vehicle_id?: string | null;
          service_id?: string | null;
          requested_at?: string | null;
          notes?: string | null;
          status?: 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          business_id?: string;
          vehicle_id?: string | null;
          service_id?: string | null;
          requested_at?: string | null;
          notes?: string | null;
          status?: 'pending' | 'scheduled' | 'confirmed' | 'rejected' | 'cancelled' | 'completed';
          created_at?: string;
        };
        Relationships: [];
      };
      follows: {
        Row: {
          id: string;
          client_id: string;
          business_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          business_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          business_id?: string;
          created_at?: string;
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
    };
    Views: Record<string, never>;
    Functions: {
      find_user_id_by_email: {
        Args: { target_email: string };
        Returns: string | null;
      };
      get_business_employees: {
        Args: { target_business_id: string };
        Returns: {
          id: string;
          business_id: string;
          user_id: string;
          role: 'owner' | 'mechanic';
          can_accept_aid_requests: boolean;
          created_at: string;
          full_name: string;
          email: string;
          phone: string | null;
        }[];
      };
      increment_ad_metric: {
        Args: { ad_id: string; metric: string };
        Returns: undefined;
      };
      increment_story_metric: {
        Args: { story_id: string; metric: string };
        Returns: undefined;
      };
    };
  };
}
