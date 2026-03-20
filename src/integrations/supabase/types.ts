export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          auto_criteria: Json | null
          badge_type: string
          color: string | null
          created_at: string
          description: string | null
          icon: string | null
          id: string
          label: string
          name: string
          sort_order: number
        }
        Insert: {
          auto_criteria?: Json | null
          badge_type?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          label: string
          name: string
          sort_order?: number
        }
        Update: {
          auto_criteria?: Json | null
          badge_type?: string
          color?: string | null
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          label?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          duration_hours: number
          end_time: string
          id: string
          notes: string | null
          project_id: string | null
          service_id: string | null
          staff_member_id: string | null
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          end_time: string
          id?: string
          notes?: string | null
          project_id?: string | null
          service_id?: string | null
          staff_member_id?: string | null
          start_time: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_hours?: number
          end_time?: string
          id?: string
          notes?: string | null
          project_id?: string | null
          service_id?: string | null
          staff_member_id?: string | null
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          project_id: string | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          project_id?: string | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          project_id?: string | null
          start_time?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          payment_method: string | null
          payment_reference: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          type?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          payment_method?: string | null
          payment_reference?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      drop_room_members: {
        Row: {
          id: string
          joined_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "drop_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_room_posts: {
        Row: {
          content: string
          created_at: string
          file_url: string | null
          id: string
          post_type: string
          room_id: string
          upvotes: number
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_url?: string | null
          id?: string
          post_type?: string
          room_id: string
          upvotes?: number
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_url?: string | null
          id?: string
          post_type?: string
          room_id?: string
          upvotes?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_room_posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "drop_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      drop_rooms: {
        Row: {
          allow_spectators: boolean
          category: string
          cover_color: string | null
          created_at: string
          created_by: string
          description: string | null
          enable_recording: boolean
          enable_video: boolean
          expires_at: string
          id: string
          is_active: boolean
          max_members: number | null
          title: string
          updated_at: string
        }
        Insert: {
          allow_spectators?: boolean
          category?: string
          cover_color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          enable_recording?: boolean
          enable_video?: boolean
          expires_at: string
          id?: string
          is_active?: boolean
          max_members?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          allow_spectators?: boolean
          category?: string
          cover_color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          enable_recording?: boolean
          enable_video?: boolean
          expires_at?: string
          id?: string
          is_active?: boolean
          max_members?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      escrow_transactions: {
        Row: {
          amount: number
          contract_id: string
          created_at: string
          description: string | null
          from_user_id: string
          id: string
          milestone_id: string | null
          status: string
          to_user_id: string | null
          type: string
        }
        Insert: {
          amount: number
          contract_id: string
          created_at?: string
          description?: string | null
          from_user_id: string
          id?: string
          milestone_id?: string | null
          status?: string
          to_user_id?: string | null
          type?: string
        }
        Update: {
          amount?: number
          contract_id?: string
          created_at?: string
          description?: string | null
          from_user_id?: string
          id?: string
          milestone_id?: string | null
          status?: string
          to_user_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "escrow_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "project_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "escrow_transactions_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_interactions: {
        Row: {
          action: string
          created_at: string
          flow_item_id: string
          id: string
          smartboard_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          flow_item_id: string
          id?: string
          smartboard_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          flow_item_id?: string
          id?: string
          smartboard_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_interactions_flow_item_id_fkey"
            columns: ["flow_item_id"]
            isOneToOne: false
            referencedRelation: "flow_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_interactions_smartboard_id_fkey"
            columns: ["smartboard_id"]
            isOneToOne: false
            referencedRelation: "smartboards"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_items: {
        Row: {
          category: string
          content_type: string
          created_at: string
          description: string | null
          file_url: string | null
          id: string
          link_url: string | null
          tags: string[] | null
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          content_type?: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          tags?: string[] | null
          title: string
          user_id: string
        }
        Update: {
          category?: string
          content_type?: string
          created_at?: string
          description?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          tags?: string[] | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_inquiries: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          message: string
          project_id: string | null
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          message: string
          project_id?: string | null
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          message?: string
          project_id?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_inquiries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_media: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          listing_id: string
          sort_order: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          listing_id: string
          sort_order?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          listing_id?: string
          sort_order?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_media_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          contact_info: string | null
          cover_url: string | null
          created_at: string
          credits_price: number | null
          currency: string
          delivery_days: number | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          listing_type: string
          price: number | null
          revisions: number | null
          shipping_info: string | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          contact_info?: string | null
          cover_url?: string | null
          created_at?: string
          credits_price?: number | null
          currency?: string
          delivery_days?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          listing_type?: string
          price?: number | null
          revisions?: number | null
          shipping_info?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          contact_info?: string | null
          cover_url?: string | null
          created_at?: string
          credits_price?: number | null
          currency?: string
          delivery_days?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          listing_type?: string
          price?: number | null
          revisions?: number | null
          shipping_info?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      moodboard_items: {
        Row: {
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "moodboard_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          available: boolean | null
          avatar_url: string | null
          banner_gradient: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          email_notif_inquiries: boolean | null
          email_notif_messages: boolean | null
          email_notif_purchases: boolean | null
          email_notif_reviews: boolean | null
          headline: string | null
          id: string
          instagram_url: string | null
          is_public: boolean | null
          location: string | null
          mediums: string[] | null
          portfolio_url: string | null
          profile_background: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          shipping_zip: string | null
          show_offerings: boolean | null
          show_public_boards: boolean | null
          show_seller_stats: boolean | null
          skills: string[] | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          youtube_url: string | null
        }
        Insert: {
          available?: boolean | null
          avatar_url?: string | null
          banner_gradient?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email_notif_inquiries?: boolean | null
          email_notif_messages?: boolean | null
          email_notif_purchases?: boolean | null
          email_notif_reviews?: boolean | null
          headline?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean | null
          location?: string | null
          mediums?: string[] | null
          portfolio_url?: string | null
          profile_background?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          show_offerings?: boolean | null
          show_public_boards?: boolean | null
          show_seller_stats?: boolean | null
          skills?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          youtube_url?: string | null
        }
        Update: {
          available?: boolean | null
          avatar_url?: string | null
          banner_gradient?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email_notif_inquiries?: boolean | null
          email_notif_messages?: boolean | null
          email_notif_purchases?: boolean | null
          email_notif_reviews?: boolean | null
          headline?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean | null
          location?: string | null
          mediums?: string[] | null
          portfolio_url?: string | null
          profile_background?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          show_offerings?: boolean | null
          show_public_boards?: boolean | null
          show_seller_stats?: boolean | null
          skills?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          youtube_url?: string | null
        }
        Relationships: []
      }
      project_approvals: {
        Row: {
          created_at: string
          id: string
          printed_name: string
          project_id: string
          role: string
          signed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          printed_name: string
          project_id: string
          role?: string
          signed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          printed_name?: string
          project_id?: string
          role?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_collaborators: {
        Row: {
          created_at: string
          id: string
          invited_by: string
          project_id: string
          project_role: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by: string
          project_id: string
          project_role?: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string
          project_id?: string
          project_role?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_collaborators_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_contracts: {
        Row: {
          auto_release_days: number
          client_id: string
          created_at: string
          escrowed_credits: number
          id: string
          listing_id: string | null
          notes: string | null
          project_id: string
          released_credits: number
          specialist_id: string
          status: string
          total_credits: number
          updated_at: string
        }
        Insert: {
          auto_release_days?: number
          client_id: string
          created_at?: string
          escrowed_credits?: number
          id?: string
          listing_id?: string | null
          notes?: string | null
          project_id: string
          released_credits?: number
          specialist_id: string
          status?: string
          total_credits?: number
          updated_at?: string
        }
        Update: {
          auto_release_days?: number
          client_id?: string
          created_at?: string
          escrowed_credits?: number
          id?: string
          listing_id?: string | null
          notes?: string | null
          project_id?: string
          released_credits?: number
          specialist_id?: string
          status?: string
          total_credits?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_contracts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_deliverables: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          project_id: string
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          project_id: string
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          project_id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_goals: {
        Row: {
          assignee_id: string | null
          budget_amount: number
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          location: string | null
          parent_id: string | null
          priority: string
          progress: number
          project_id: string
          sort_order: number
          stage_date_end: string | null
          stage_date_start: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assignee_id?: string | null
          budget_amount?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          location?: string | null
          parent_id?: string | null
          priority?: string
          progress?: number
          project_id: string
          sort_order?: number
          stage_date_end?: string | null
          stage_date_start?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assignee_id?: string | null
          budget_amount?: number
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          location?: string | null
          parent_id?: string | null
          priority?: string
          progress?: number
          project_id?: string
          sort_order?: number
          stage_date_end?: string | null
          stage_date_start?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_goals_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_goals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_milestones: {
        Row: {
          approved_at: string | null
          auto_release_at: string | null
          contract_id: string
          created_at: string
          credit_amount: number
          description: string | null
          due_date: string | null
          id: string
          proposed_by: string
          sort_order: number
          status: string
          submitted_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          auto_release_at?: string | null
          contract_id: string
          created_at?: string
          credit_amount?: number
          description?: string | null
          due_date?: string | null
          id?: string
          proposed_by: string
          sort_order?: number
          status?: string
          submitted_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          auto_release_at?: string | null
          contract_id?: string
          created_at?: string
          credit_amount?: number
          description?: string | null
          due_date?: string | null
          id?: string
          proposed_by?: string
          sort_order?: number
          status?: string
          submitted_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_milestones_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "project_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      project_smartboards: {
        Row: {
          created_at: string
          id: string
          linked_by: string
          project_id: string
          smartboard_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          linked_by: string
          project_id: string
          smartboard_id: string
        }
        Update: {
          created_at?: string
          id?: string
          linked_by?: string
          project_id?: string
          smartboard_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_smartboards_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_smartboards_smartboard_id_fkey"
            columns: ["smartboard_id"]
            isOneToOne: false
            referencedRelation: "smartboards"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          categories: string[] | null
          client_name: string | null
          cover_color: string | null
          created_at: string
          currency: string
          description: string | null
          id: string
          is_estimate: boolean
          project_type: string | null
          runtime_notes: string | null
          scope_of_work: string | null
          status: string
          title: string
          total_budget: number
          updated_at: string
          user_id: string
          vision: string | null
        }
        Insert: {
          categories?: string[] | null
          client_name?: string | null
          cover_color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_estimate?: boolean
          project_type?: string | null
          runtime_notes?: string | null
          scope_of_work?: string | null
          status?: string
          title: string
          total_budget?: number
          updated_at?: string
          user_id: string
          vision?: string | null
        }
        Update: {
          categories?: string[] | null
          client_name?: string | null
          cover_color?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          is_estimate?: boolean
          project_type?: string | null
          runtime_notes?: string | null
          scope_of_work?: string | null
          status?: string
          title?: string
          total_budget?: number
          updated_at?: string
          user_id?: string
          vision?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          buyer_id: string
          created_at: string
          credits_paid: number
          id: string
          listing_id: string
          seller_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          credits_paid: number
          id?: string
          listing_id: string
          seller_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          credits_paid?: number
          id?: string
          listing_id?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          listing_id: string
          rating: number
          reviewer_id: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id: string
          rating: number
          reviewer_id: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          rating?: number
          reviewer_id?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string
          created_at: string
          credits_cost: number
          description: string | null
          duration_hours: number
          id: string
          image_url: string | null
          is_active: boolean
          non_member_rate: number | null
          revisions_info: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          credits_cost?: number
          description?: string | null
          duration_hours?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          non_member_rate?: number | null
          revisions_info?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          credits_cost?: number
          description?: string | null
          duration_hours?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          non_member_rate?: number | null
          revisions_info?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      smartboard_items: {
        Row: {
          content: string | null
          content_type: string
          created_at: string
          file_url: string | null
          id: string
          item_height: number | null
          item_width: number | null
          link_url: string | null
          position_x: number | null
          position_y: number | null
          smartboard_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          content_type?: string
          created_at?: string
          file_url?: string | null
          id?: string
          item_height?: number | null
          item_width?: number | null
          link_url?: string | null
          position_x?: number | null
          position_y?: number | null
          smartboard_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          content_type?: string
          created_at?: string
          file_url?: string | null
          id?: string
          item_height?: number | null
          item_width?: number | null
          link_url?: string | null
          position_x?: number | null
          position_y?: number | null
          smartboard_id?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartboard_items_smartboard_id_fkey"
            columns: ["smartboard_id"]
            isOneToOne: false
            referencedRelation: "smartboards"
            referencedColumns: ["id"]
          },
        ]
      }
      smartboard_members: {
        Row: {
          created_at: string
          id: string
          role: string
          smartboard_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: string
          smartboard_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          smartboard_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartboard_members_smartboard_id_fkey"
            columns: ["smartboard_id"]
            isOneToOne: false
            referencedRelation: "smartboards"
            referencedColumns: ["id"]
          },
        ]
      }
      smartboard_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          smartboard_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          smartboard_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          smartboard_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smartboard_messages_smartboard_id_fkey"
            columns: ["smartboard_id"]
            isOneToOne: false
            referencedRelation: "smartboards"
            referencedColumns: ["id"]
          },
        ]
      }
      smartboards: {
        Row: {
          background_blur: number | null
          background_color: string | null
          background_opacity: number | null
          background_url: string | null
          cover_color: string | null
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          background_blur?: number | null
          background_color?: string | null
          background_opacity?: number | null
          background_url?: string | null
          cover_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          background_blur?: number | null
          background_color?: string | null
          background_opacity?: number | null
          background_url?: string | null
          cover_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          is_available: boolean
          specialties: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_available?: boolean
          specialties?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_available?: boolean
          specialties?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          project_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          project_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          awarded_by: string | null
          badge_id: string
          id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id: string
          id?: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          awarded_by?: string | null
          badge_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          subscription_end: string | null
          subscription_start: string | null
          tier: string
          tier_credits_monthly: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          subscription_end?: string | null
          subscription_start?: string | null
          tier?: string
          tier_credits_monthly?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          subscription_end?: string | null
          subscription_start?: string | null
          tier?: string
          tier_credits_monthly?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      convert_inquiry_to_project: {
        Args: {
          _inquiry_id: string
          _receiver_id: string
          _total_credits?: number
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_contract_party: {
        Args: { _contract_id: string; _user_id: string }
        Returns: boolean
      }
      lock_escrow_credits: {
        Args: { _amount: number; _client_id: string; _contract_id: string }
        Returns: undefined
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      purchase_listing: {
        Args: { _buyer_id: string; _listing_id: string }
        Returns: string
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      release_milestone_credits: {
        Args: { _approver_id: string; _milestone_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
