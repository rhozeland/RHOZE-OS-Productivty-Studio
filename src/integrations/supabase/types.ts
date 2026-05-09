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
      artist_verification_requests: {
        Row: {
          bio: string | null
          contact_email: string
          created_at: string
          decided_at: string | null
          id: string
          review_note: string | null
          reviewer_id: string | null
          social_links: Json
          status: string
          updated_at: string
          user_id: string
          video_url: string
          wallet_address: string | null
        }
        Insert: {
          bio?: string | null
          contact_email: string
          created_at?: string
          decided_at?: string | null
          id?: string
          review_note?: string | null
          reviewer_id?: string | null
          social_links?: Json
          status?: string
          updated_at?: string
          user_id: string
          video_url: string
          wallet_address?: string | null
        }
        Update: {
          bio?: string | null
          contact_email?: string
          created_at?: string
          decided_at?: string | null
          id?: string
          review_note?: string | null
          reviewer_id?: string | null
          social_links?: Json
          status?: string
          updated_at?: string
          user_id?: string
          video_url?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
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
          meeting_url: string | null
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
          meeting_url?: string | null
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
          meeting_url?: string | null
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
          attendees: string[]
          color: string | null
          created_at: string
          description: string | null
          end_time: string
          id: string
          project_id: string | null
          reminder_minutes: number | null
          start_time: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attendees?: string[]
          color?: string | null
          created_at?: string
          description?: string | null
          end_time: string
          id?: string
          project_id?: string | null
          reminder_minutes?: number | null
          start_time: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attendees?: string[]
          color?: string | null
          created_at?: string
          description?: string | null
          end_time?: string
          id?: string
          project_id?: string | null
          reminder_minutes?: number | null
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
      capital_advance_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          from_status:
            | Database["public"]["Enums"]["capital_advance_status"]
            | null
          id: string
          metadata: Json
          note: string | null
          request_id: string
          to_status:
            | Database["public"]["Enums"]["capital_advance_status"]
            | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          from_status?:
            | Database["public"]["Enums"]["capital_advance_status"]
            | null
          id?: string
          metadata?: Json
          note?: string | null
          request_id: string
          to_status?:
            | Database["public"]["Enums"]["capital_advance_status"]
            | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          from_status?:
            | Database["public"]["Enums"]["capital_advance_status"]
            | null
          id?: string
          metadata?: Json
          note?: string | null
          request_id?: string
          to_status?:
            | Database["public"]["Enums"]["capital_advance_status"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "capital_advance_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "capital_advance_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_advance_requests: {
        Row: {
          admin_note: string | null
          applicant_note: string | null
          collateral_score: number | null
          created_at: string
          funded_amount: number | null
          funded_at: string | null
          id: string
          requested_amount: number
          reviewed_at: string | null
          reviewed_by: string | null
          signal_snapshot: Json
          status: Database["public"]["Enums"]["capital_advance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          applicant_note?: string | null
          collateral_score?: number | null
          created_at?: string
          funded_amount?: number | null
          funded_at?: string | null
          id?: string
          requested_amount: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_snapshot?: Json
          status?: Database["public"]["Enums"]["capital_advance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          applicant_note?: string | null
          collateral_score?: number | null
          created_at?: string
          funded_amount?: number | null
          funded_at?: string | null
          id?: string
          requested_amount?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          signal_snapshot?: Json
          status?: Database["public"]["Enums"]["capital_advance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      capital_underwriting_rules: {
        Row: {
          advance_cap: number
          anchored_score_per_work: number
          base_advance_ratio: number
          diversification_floor_per_work: number
          id: number
          min_advance_amount: number
          min_anchored_works: number
          min_settled_events: number
          provenance_bonus_max: number
          revenue_score_target: number
          score_weight_anchored: number
          score_weight_provenance: number
          score_weight_revenue: number
          score_weight_tenure: number
          tenure_floor_mult: number
          tenure_full_months: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          advance_cap?: number
          anchored_score_per_work?: number
          base_advance_ratio?: number
          diversification_floor_per_work?: number
          id?: number
          min_advance_amount?: number
          min_anchored_works?: number
          min_settled_events?: number
          provenance_bonus_max?: number
          revenue_score_target?: number
          score_weight_anchored?: number
          score_weight_provenance?: number
          score_weight_revenue?: number
          score_weight_tenure?: number
          tenure_floor_mult?: number
          tenure_full_months?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          advance_cap?: number
          anchored_score_per_work?: number
          base_advance_ratio?: number
          diversification_floor_per_work?: number
          id?: number
          min_advance_amount?: number
          min_anchored_works?: number
          min_settled_events?: number
          provenance_bonus_max?: number
          revenue_score_target?: number
          score_weight_anchored?: number
          score_weight_provenance?: number
          score_weight_revenue?: number
          score_weight_tenure?: number
          tenure_floor_mult?: number
          tenure_full_months?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      capital_underwriting_rules_audit: {
        Row: {
          changed_at: string
          changed_by: string | null
          changed_fields: string[]
          id: string
          new_values: Json
          old_values: Json
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          id?: string
          new_values: Json
          old_values: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          changed_fields?: string[]
          id?: string
          new_values?: Json
          old_values?: Json
        }
        Relationships: []
      }
      chat_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_group_messages: {
        Row: {
          content: string
          created_at: string
          group_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          group_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          group_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "chat_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_groups: {
        Row: {
          avatar_url: string | null
          created_at: string
          creator_id: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          creator_id: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          creator_id?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      coin_hold_snapshots: {
        Row: {
          last_30d_reward_at: string | null
          last_7d_reward_at: string | null
          launch_id: string
          snapshot_balance: number
          updated_at: string
          user_id: string
          window_start: string
        }
        Insert: {
          last_30d_reward_at?: string | null
          last_7d_reward_at?: string | null
          launch_id: string
          snapshot_balance: number
          updated_at?: string
          user_id: string
          window_start?: string
        }
        Update: {
          last_30d_reward_at?: string | null
          last_7d_reward_at?: string | null
          launch_id?: string
          snapshot_balance?: number
          updated_at?: string
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_hold_snapshots_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "coin_launches"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_holdings: {
        Row: {
          balance: number
          launch_id: string
          sol_invested: number
          trader_id: string
          updated_at: string
        }
        Insert: {
          balance?: number
          launch_id: string
          sol_invested?: number
          trader_id: string
          updated_at?: string
        }
        Update: {
          balance?: number
          launch_id?: string
          sol_invested?: number
          trader_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_holdings_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "coin_launches"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_launches: {
        Row: {
          created_at: string
          creator_fee_bps: number
          creator_fees_earned: number
          creator_id: string
          description: string | null
          event_id: string | null
          graduated_at: string | null
          graduation_sol_target: number
          id: string
          image_url: string | null
          lp_lock_months: number
          mint_address: string | null
          name: string
          platform_fee_bps: number
          platform_fees_earned: number
          raydium_pool: string | null
          real_sol_reserves: number
          real_token_reserves: number
          space_id: string | null
          status: string
          ticker: string
          total_supply: number
          updated_at: string
          virtual_sol_reserves: number
          virtual_token_reserves: number
          work_id: string | null
        }
        Insert: {
          created_at?: string
          creator_fee_bps?: number
          creator_fees_earned?: number
          creator_id: string
          description?: string | null
          event_id?: string | null
          graduated_at?: string | null
          graduation_sol_target?: number
          id?: string
          image_url?: string | null
          lp_lock_months?: number
          mint_address?: string | null
          name: string
          platform_fee_bps?: number
          platform_fees_earned?: number
          raydium_pool?: string | null
          real_sol_reserves?: number
          real_token_reserves?: number
          space_id?: string | null
          status?: string
          ticker: string
          total_supply?: number
          updated_at?: string
          virtual_sol_reserves?: number
          virtual_token_reserves?: number
          work_id?: string | null
        }
        Update: {
          created_at?: string
          creator_fee_bps?: number
          creator_fees_earned?: number
          creator_id?: string
          description?: string | null
          event_id?: string | null
          graduated_at?: string | null
          graduation_sol_target?: number
          id?: string
          image_url?: string | null
          lp_lock_months?: number
          mint_address?: string | null
          name?: string
          platform_fee_bps?: number
          platform_fees_earned?: number
          raydium_pool?: string | null
          real_sol_reserves?: number
          real_token_reserves?: number
          space_id?: string | null
          status?: string
          ticker?: string
          total_supply?: number
          updated_at?: string
          virtual_sol_reserves?: number
          virtual_token_reserves?: number
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coin_launches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_launches_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coin_launches_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_swap_ledger: {
        Row: {
          created_at: string
          id: string
          launch_id: string
          price_per_token: number
          rhoze_amount: number
          rhoze_balance_after: number
          rhoze_fee: number
          side: string
          token_amount: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          launch_id: string
          price_per_token: number
          rhoze_amount: number
          rhoze_balance_after: number
          rhoze_fee?: number
          side: string
          token_amount: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          launch_id?: string
          price_per_token?: number
          rhoze_amount?: number
          rhoze_balance_after?: number
          rhoze_fee?: number
          side?: string
          token_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_swap_ledger_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "coin_launches"
            referencedColumns: ["id"]
          },
        ]
      }
      coin_trades: {
        Row: {
          created_at: string
          fee_sol: number
          id: string
          launch_id: string
          price_per_token: number
          side: string
          sol_amount: number
          token_amount: number
          trader_id: string
        }
        Insert: {
          created_at?: string
          fee_sol?: number
          id?: string
          launch_id: string
          price_per_token: number
          side: string
          sol_amount: number
          token_amount: number
          trader_id: string
        }
        Update: {
          created_at?: string
          fee_sol?: number
          id?: string
          launch_id?: string
          price_per_token?: number
          side?: string
          sol_amount?: number
          token_amount?: number
          trader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coin_trades_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "coin_launches"
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
      contribution_proofs: {
        Row: {
          action_type: string
          anchored_at: string | null
          created_at: string
          id: string
          metadata: Json | null
          reference_id: string | null
          solana_signature: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          anchored_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          solana_signature?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          anchored_at?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          reference_id?: string | null
          solana_signature?: string | null
          user_id?: string
        }
        Relationships: []
      }
      creator_availability: {
        Row: {
          created_at: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      creator_availability_recurring: {
        Row: {
          created_at: string
          end_minute: number
          id: string
          start_minute: number
          updated_at: string
          user_id: string
          weekday: number
        }
        Insert: {
          created_at?: string
          end_minute: number
          id?: string
          start_minute: number
          updated_at?: string
          user_id: string
          weekday: number
        }
        Update: {
          created_at?: string
          end_minute?: number
          id?: string
          start_minute?: number
          updated_at?: string
          user_id?: string
          weekday?: number
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
      curator_invites: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          message: string | null
          pct: number
          responded_at: string | null
          split_config_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          message?: string | null
          pct?: number
          responded_at?: string | null
          split_config_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          message?: string | null
          pct?: number
          responded_at?: string | null
          split_config_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "curator_invites_split_config_id_fkey"
            columns: ["split_config_id"]
            isOneToOne: false
            referencedRelation: "revenue_split_configs"
            referencedColumns: ["id"]
          },
        ]
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      event_artifacts: {
        Row: {
          anchored_at: string | null
          caption: string | null
          created_at: string
          event_id: string
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          sha256_hash: string | null
          solana_signature: string | null
          uploader_id: string
        }
        Insert: {
          anchored_at?: string | null
          caption?: string | null
          created_at?: string
          event_id: string
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          sha256_hash?: string | null
          solana_signature?: string | null
          uploader_id: string
        }
        Update: {
          anchored_at?: string | null
          caption?: string | null
          created_at?: string
          event_id?: string
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          sha256_hash?: string | null
          solana_signature?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_artifacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_check_ins: {
        Row: {
          id: string
          method: string
          scanned_at: string
          scanned_by: string
          ticket_id: string
        }
        Insert: {
          id?: string
          method?: string
          scanned_at?: string
          scanned_by: string
          ticket_id: string
        }
        Update: {
          id?: string
          method?: string
          scanned_at?: string
          scanned_by?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_check_ins_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "event_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_collaborators: {
        Row: {
          created_at: string
          event_id: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["event_collaborator_role"]
          status: Database["public"]["Enums"]["event_collaborator_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["event_collaborator_role"]
          status?: Database["public"]["Enums"]["event_collaborator_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["event_collaborator_role"]
          status?: Database["public"]["Enums"]["event_collaborator_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_collaborators_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_media: {
        Row: {
          caption: string | null
          created_at: string
          event_id: string
          id: string
          media_type: string
          sort_order: number
          thumbnail_url: string | null
          uploaded_by: string
          url: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          event_id: string
          id?: string
          media_type: string
          sort_order?: number
          thumbnail_url?: string | null
          uploaded_by: string
          url: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          event_id?: string
          id?: string
          media_type?: string
          sort_order?: number
          thumbnail_url?: string | null
          uploaded_by?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_media_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_settlements: {
        Row: {
          buyer_id: string
          created_at: string
          currency: string
          event_id: string
          gross_amount: number
          host_amount: number
          host_id: string
          id: string
          payment_reference: string | null
          platform_amount: number
          reserve_amount: number | null
          ticket_id: string
        }
        Insert: {
          buyer_id: string
          created_at?: string
          currency: string
          event_id: string
          gross_amount: number
          host_amount: number
          host_id: string
          id?: string
          payment_reference?: string | null
          platform_amount: number
          reserve_amount?: number | null
          ticket_id: string
        }
        Update: {
          buyer_id?: string
          created_at?: string
          currency?: string
          event_id?: string
          gross_amount?: number
          host_amount?: number
          host_id?: string
          id?: string
          payment_reference?: string | null
          platform_amount?: number
          reserve_amount?: number | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_settlements_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_ticket_settlements_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "event_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      event_ticket_tiers: {
        Row: {
          created_at: string
          currency_code: string
          description: string | null
          event_id: string
          id: string
          is_active: boolean
          name: string
          price_rhoze: number | null
          price_usd: number | null
          quantity_sold: number
          quantity_total: number | null
          sale_ends_at: string | null
          sale_starts_at: string | null
          sort_order: number
          tier_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code?: string
          description?: string | null
          event_id: string
          id?: string
          is_active?: boolean
          name: string
          price_rhoze?: number | null
          price_usd?: number | null
          quantity_sold?: number
          quantity_total?: number | null
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sort_order?: number
          tier_kind?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          description?: string | null
          event_id?: string
          id?: string
          is_active?: boolean
          name?: string
          price_rhoze?: number | null
          price_usd?: number | null
          quantity_sold?: number
          quantity_total?: number | null
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          sort_order?: number
          tier_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_ticket_tiers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_tickets: {
        Row: {
          amount_paid: number
          anchor_attempts: number
          anchor_last_attempt_at: string | null
          anchor_last_error: string | null
          anchor_proof_id: string | null
          anchored_at: string | null
          approved_at: string | null
          approved_by: string | null
          attendance_hash: string | null
          checked_in_at: string | null
          event_id: string
          guest_email: string | null
          guest_name: string | null
          holder_id: string
          id: string
          issued_at: string
          metadata: Json
          payment_reference: string | null
          purchase_currency: Database["public"]["Enums"]["event_purchase_currency"]
          qr_token: string
          requested_at: string | null
          solana_signature: string | null
          status: Database["public"]["Enums"]["event_ticket_status"]
          tier_id: string | null
        }
        Insert: {
          amount_paid?: number
          anchor_attempts?: number
          anchor_last_attempt_at?: string | null
          anchor_last_error?: string | null
          anchor_proof_id?: string | null
          anchored_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_hash?: string | null
          checked_in_at?: string | null
          event_id: string
          guest_email?: string | null
          guest_name?: string | null
          holder_id: string
          id?: string
          issued_at?: string
          metadata?: Json
          payment_reference?: string | null
          purchase_currency?: Database["public"]["Enums"]["event_purchase_currency"]
          qr_token: string
          requested_at?: string | null
          solana_signature?: string | null
          status?: Database["public"]["Enums"]["event_ticket_status"]
          tier_id?: string | null
        }
        Update: {
          amount_paid?: number
          anchor_attempts?: number
          anchor_last_attempt_at?: string | null
          anchor_last_error?: string | null
          anchor_proof_id?: string | null
          anchored_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          attendance_hash?: string | null
          checked_in_at?: string | null
          event_id?: string
          guest_email?: string | null
          guest_name?: string | null
          holder_id?: string
          id?: string
          issued_at?: string
          metadata?: Json
          payment_reference?: string | null
          purchase_currency?: Database["public"]["Enums"]["event_purchase_currency"]
          qr_token?: string
          requested_at?: string | null
          solana_signature?: string | null
          status?: Database["public"]["Enums"]["event_ticket_status"]
          tier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_tickets_anchor_proof_id_fkey"
            columns: ["anchor_proof_id"]
            isOneToOne: false
            referencedRelation: "contribution_proofs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tickets_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_tickets_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "event_ticket_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          anchored_at: string | null
          capacity: number | null
          category: string
          country_code: string | null
          cover_url: string | null
          cover_url_poster: string | null
          created_at: string
          currency_code: string
          description: string | null
          ends_at: string
          host_id: string
          id: string
          is_online: boolean
          manifest_hash: string | null
          manifest_json: Json | null
          online_url: string | null
          slug: string | null
          solana_signature: string | null
          space_id: string | null
          starts_at: string
          status: Database["public"]["Enums"]["event_status"]
          ticket_currency_modes: string[]
          title: string
          updated_at: string
          venue_address: string | null
          venue_name: string | null
        }
        Insert: {
          anchored_at?: string | null
          capacity?: number | null
          category?: string
          country_code?: string | null
          cover_url?: string | null
          cover_url_poster?: string | null
          created_at?: string
          currency_code?: string
          description?: string | null
          ends_at: string
          host_id: string
          id?: string
          is_online?: boolean
          manifest_hash?: string | null
          manifest_json?: Json | null
          online_url?: string | null
          slug?: string | null
          solana_signature?: string | null
          space_id?: string | null
          starts_at: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_currency_modes?: string[]
          title: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Update: {
          anchored_at?: string | null
          capacity?: number | null
          category?: string
          country_code?: string | null
          cover_url?: string | null
          cover_url_poster?: string | null
          created_at?: string
          currency_code?: string
          description?: string | null
          ends_at?: string
          host_id?: string
          id?: string
          is_online?: boolean
          manifest_hash?: string | null
          manifest_json?: Json | null
          online_url?: string | null
          slug?: string | null
          solana_signature?: string | null
          space_id?: string | null
          starts_at?: string
          status?: Database["public"]["Enums"]["event_status"]
          ticket_currency_modes?: string[]
          title?: string
          updated_at?: string
          venue_address?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_comments: {
        Row: {
          body: string
          created_at: string
          flow_item_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          flow_item_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          flow_item_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_comments_flow_item_id_fkey"
            columns: ["flow_item_id"]
            isOneToOne: false
            referencedRelation: "flow_items"
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
          anchored_at: string | null
          category: string
          content_hash: string | null
          content_type: string
          created_at: string
          creator_name: string | null
          description: string | null
          file_url: string | null
          id: string
          link_url: string | null
          solana_signature: string | null
          tags: string[] | null
          title: string
          user_id: string
          verification_status: string
          work_id: string | null
        }
        Insert: {
          anchored_at?: string | null
          category?: string
          content_hash?: string | null
          content_type?: string
          created_at?: string
          creator_name?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          solana_signature?: string | null
          tags?: string[] | null
          title: string
          user_id: string
          verification_status?: string
          work_id?: string | null
        }
        Update: {
          anchored_at?: string | null
          category?: string
          content_hash?: string | null
          content_type?: string
          created_at?: string
          creator_name?: string | null
          description?: string | null
          file_url?: string | null
          id?: string
          link_url?: string | null
          solana_signature?: string | null
          tags?: string[] | null
          title?: string
          user_id?: string
          verification_status?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_items_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      host_payout_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          currency_code: string
          host_id: string
          id: string
          paid_at: string | null
          payout_details: Json | null
          payout_method: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          currency_code?: string
          host_id: string
          id?: string
          paid_at?: string | null
          payout_details?: Json | null
          payout_method: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency_code?: string
          host_id?: string
          id?: string
          paid_at?: string | null
          payout_details?: Json | null
          payout_method?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
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
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          kind: string
          link_url: string | null
          note: string | null
          position: number
          project_id: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          note?: string | null
          position?: number
          project_id: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          kind?: string
          link_url?: string | null
          note?: string | null
          position?: number
          project_id?: string
          title?: string | null
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
      pending_rewards: {
        Row: {
          action_type: string
          amount: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string
        }
        Insert: {
          action_type: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_fee_tiers: {
        Row: {
          fee_bps: number
          label: string
          min_balance: number
          sort_order: number
          tier_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          fee_bps: number
          label: string
          min_balance: number
          sort_order: number
          tier_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          fee_bps?: number
          label?: string
          min_balance?: number
          sort_order?: number
          tier_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      platform_fee_tiers_audit: {
        Row: {
          changed_at: string
          changed_by: string
          id: string
          payload: Json
        }
        Insert: {
          changed_at?: string
          changed_by: string
          id?: string
          payload: Json
        }
        Update: {
          changed_at?: string
          changed_by?: string
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          available: boolean | null
          avatar_url: string | null
          ban_reason: string | null
          ban_status: string
          banned_at: string | null
          banner_gradient: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          creator_roles: string[]
          dashboard_layout: Json | null
          display_name: string | null
          dock_config: Json | null
          email_notif_inquiries: boolean | null
          email_notif_messages: boolean | null
          email_notif_purchases: boolean | null
          email_notif_reviews: boolean | null
          flow_feed_scope: string | null
          flow_preferred_categories: string[] | null
          headline: string | null
          id: string
          instagram_url: string | null
          is_public: boolean | null
          location: string | null
          mediums: string[] | null
          portfolio_url: string | null
          primary_role: string | null
          profile_background: string | null
          profile_layout: Json | null
          region_code: string | null
          shipping_address_line1: string | null
          shipping_address_line2: string | null
          shipping_city: string | null
          shipping_country: string | null
          shipping_state: string | null
          shipping_zip: string | null
          show_flow_posts: boolean | null
          show_offerings: boolean | null
          show_public_boards: boolean | null
          show_seller_stats: boolean | null
          skills: string[] | null
          tiktok_url: string | null
          twitter_url: string | null
          updated_at: string
          user_id: string
          username: string | null
          verification_status: string
          verified_at: string | null
          wallet_address: string | null
          wallet_locked: boolean
          youtube_url: string | null
        }
        Insert: {
          available?: boolean | null
          avatar_url?: string | null
          ban_reason?: string | null
          ban_status?: string
          banned_at?: string | null
          banner_gradient?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          creator_roles?: string[]
          dashboard_layout?: Json | null
          display_name?: string | null
          dock_config?: Json | null
          email_notif_inquiries?: boolean | null
          email_notif_messages?: boolean | null
          email_notif_purchases?: boolean | null
          email_notif_reviews?: boolean | null
          flow_feed_scope?: string | null
          flow_preferred_categories?: string[] | null
          headline?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean | null
          location?: string | null
          mediums?: string[] | null
          portfolio_url?: string | null
          primary_role?: string | null
          profile_background?: string | null
          profile_layout?: Json | null
          region_code?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          show_flow_posts?: boolean | null
          show_offerings?: boolean | null
          show_public_boards?: boolean | null
          show_seller_stats?: boolean | null
          skills?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id: string
          username?: string | null
          verification_status?: string
          verified_at?: string | null
          wallet_address?: string | null
          wallet_locked?: boolean
          youtube_url?: string | null
        }
        Update: {
          available?: boolean | null
          avatar_url?: string | null
          ban_reason?: string | null
          ban_status?: string
          banned_at?: string | null
          banner_gradient?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          creator_roles?: string[]
          dashboard_layout?: Json | null
          display_name?: string | null
          dock_config?: Json | null
          email_notif_inquiries?: boolean | null
          email_notif_messages?: boolean | null
          email_notif_purchases?: boolean | null
          email_notif_reviews?: boolean | null
          flow_feed_scope?: string | null
          flow_preferred_categories?: string[] | null
          headline?: string | null
          id?: string
          instagram_url?: string | null
          is_public?: boolean | null
          location?: string | null
          mediums?: string[] | null
          portfolio_url?: string | null
          primary_role?: string | null
          profile_background?: string | null
          profile_layout?: Json | null
          region_code?: string | null
          shipping_address_line1?: string | null
          shipping_address_line2?: string | null
          shipping_city?: string | null
          shipping_country?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          show_flow_posts?: boolean | null
          show_offerings?: boolean | null
          show_public_boards?: boolean | null
          show_seller_stats?: boolean | null
          skills?: string[] | null
          tiktok_url?: string | null
          twitter_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string | null
          verification_status?: string
          verified_at?: string | null
          wallet_address?: string | null
          wallet_locked?: boolean
          youtube_url?: string | null
        }
        Relationships: []
      }
      project_approvals: {
        Row: {
          created_at: string
          goal_id: string | null
          id: string
          printed_name: string
          project_id: string
          role: string
          signed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id?: string | null
          id?: string
          printed_name: string
          project_id: string
          role?: string
          signed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string | null
          id?: string
          printed_name?: string
          project_id?: string
          role?: string
          signed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_approvals_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "project_goals"
            referencedColumns: ["id"]
          },
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
          anchored_at: string | null
          completed: boolean
          content_hash: string | null
          created_at: string
          file_name: string | null
          file_size: number | null
          file_uploaded_at: string | null
          file_url: string | null
          id: string
          mime_type: string | null
          project_id: string
          solana_signature: string | null
          sort_order: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          anchored_at?: string | null
          completed?: boolean
          content_hash?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_uploaded_at?: string | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          project_id: string
          solana_signature?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          anchored_at?: string | null
          completed?: boolean
          content_hash?: string | null
          created_at?: string
          file_name?: string | null
          file_size?: number | null
          file_uploaded_at?: string | null
          file_url?: string | null
          id?: string
          mime_type?: string | null
          project_id?: string
          solana_signature?: string | null
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
      project_disputes: {
        Row: {
          contract_id: string
          created_at: string
          dispute_type: string
          filed_by: string
          id: string
          milestone_id: string | null
          project_id: string
          reason: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          dispute_type?: string
          filed_by: string
          id?: string
          milestone_id?: string | null
          project_id: string
          reason: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          dispute_type?: string
          filed_by?: string
          id?: string
          milestone_id?: string | null
          project_id?: string
          reason?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_disputes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "project_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_disputes_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "project_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_disputes_project_id_fkey"
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
      revenue_split_collaborators: {
        Row: {
          config_id: string
          created_at: string
          id: string
          pct: number
          user_id: string
        }
        Insert: {
          config_id: string
          created_at?: string
          id?: string
          pct: number
          user_id: string
        }
        Update: {
          config_id?: string
          created_at?: string
          id?: string
          pct?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_split_collaborators_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "revenue_split_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_split_configs: {
        Row: {
          buyback_pct: number | null
          buyback_wallet: string | null
          contract_id: string | null
          created_at: string
          creator_id: string
          creator_pct: number | null
          curator_id: string | null
          curator_pct: number | null
          id: string
          is_active: boolean
          listing_id: string | null
          locked_at: string | null
          locked_platform_fee_bps: number | null
          splits_hash: string | null
          updated_at: string
          work_id: string | null
        }
        Insert: {
          buyback_pct?: number | null
          buyback_wallet?: string | null
          contract_id?: string | null
          created_at?: string
          creator_id: string
          creator_pct?: number | null
          curator_id?: string | null
          curator_pct?: number | null
          id?: string
          is_active?: boolean
          listing_id?: string | null
          locked_at?: string | null
          locked_platform_fee_bps?: number | null
          splits_hash?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Update: {
          buyback_pct?: number | null
          buyback_wallet?: string | null
          contract_id?: string | null
          created_at?: string
          creator_id?: string
          creator_pct?: number | null
          curator_id?: string | null
          curator_pct?: number | null
          id?: string
          is_active?: boolean
          listing_id?: string | null
          locked_at?: string | null
          locked_platform_fee_bps?: number | null
          splits_hash?: string | null
          updated_at?: string
          work_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_split_configs_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "project_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_split_configs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_split_configs_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_split_logs: {
        Row: {
          buyback_amount: number
          config_id: string
          created_at: string
          creator_amount: number
          curator_amount: number
          id: string
          platform_amount: number | null
          platform_fee_bps: number | null
          purchase_id: string | null
          solana_signature: string | null
          splits: Json | null
          splits_hash: string | null
          total_amount: number
        }
        Insert: {
          buyback_amount?: number
          config_id: string
          created_at?: string
          creator_amount: number
          curator_amount?: number
          id?: string
          platform_amount?: number | null
          platform_fee_bps?: number | null
          purchase_id?: string | null
          solana_signature?: string | null
          splits?: Json | null
          splits_hash?: string | null
          total_amount: number
        }
        Update: {
          buyback_amount?: number
          config_id?: string
          created_at?: string
          creator_amount?: number
          curator_amount?: number
          id?: string
          platform_amount?: number | null
          platform_fee_bps?: number | null
          purchase_id?: string | null
          solana_signature?: string | null
          splits?: Json | null
          splits_hash?: string | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "revenue_split_logs_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "revenue_split_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "revenue_split_logs_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
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
      reward_daily_caps: {
        Row: {
          action_type: string
          amount: number
          created_at: string
          description: string | null
          enabled: boolean
          per_day_amount_cap: number | null
          per_day_cap: number
          updated_at: string
        }
        Insert: {
          action_type: string
          amount: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          per_day_amount_cap?: number | null
          per_day_cap: number
          updated_at?: string
        }
        Update: {
          action_type?: string
          amount?: number
          created_at?: string
          description?: string | null
          enabled?: boolean
          per_day_amount_cap?: number | null
          per_day_cap?: number
          updated_at?: string
        }
        Relationships: []
      }
      rhoze_booking_ledger: {
        Row: {
          booking_id: string | null
          created_at: string
          description: string | null
          entry_kind: string
          host_id: string | null
          id: string
          metadata: Json
          payer_wallet: string | null
          rate_rhoze_per_usd: number
          rhoze_amount: number
          service_id: string | null
          solana_signature: string | null
          space_id: string | null
          usd_value: number
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          created_at?: string
          description?: string | null
          entry_kind?: string
          host_id?: string | null
          id?: string
          metadata?: Json
          payer_wallet?: string | null
          rate_rhoze_per_usd?: number
          rhoze_amount: number
          service_id?: string | null
          solana_signature?: string | null
          space_id?: string | null
          usd_value: number
          user_id: string
        }
        Update: {
          booking_id?: string | null
          created_at?: string
          description?: string | null
          entry_kind?: string
          host_id?: string | null
          id?: string
          metadata?: Json
          payer_wallet?: string | null
          rate_rhoze_per_usd?: number
          rhoze_amount?: number
          service_id?: string | null
          solana_signature?: string | null
          space_id?: string | null
          usd_value?: number
          user_id?: string
        }
        Relationships: []
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
          status: string
          studio_id: string | null
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
          status?: string
          studio_id?: string | null
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
          status?: string
          studio_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_applications: {
        Row: {
          admin_notes: string | null
          contact_email: string | null
          created_at: string
          description: string | null
          id: string
          location: string | null
          portfolio_url: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          studio_name: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          admin_notes?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          portfolio_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          studio_name: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          admin_notes?: string | null
          contact_email?: string | null
          created_at?: string
          description?: string | null
          id?: string
          location?: string | null
          portfolio_url?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          studio_name?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      studio_availability: {
        Row: {
          day_of_week: number
          end_time: string
          id: string
          is_available: boolean
          start_time: string
          studio_id: string
        }
        Insert: {
          day_of_week: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          studio_id: string
        }
        Update: {
          day_of_week?: number
          end_time?: string
          id?: string
          is_available?: boolean
          start_time?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_availability_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_bookings: {
        Row: {
          created_at: string
          end_time: string
          guest_count: number | null
          id: string
          notes: string | null
          payment_method: string | null
          start_time: string
          status: string
          studio_id: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          end_time: string
          guest_count?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          start_time: string
          status?: string
          studio_id: string
          total_price: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          end_time?: string
          guest_count?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          start_time?: string
          status?: string
          studio_id?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_bookings_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_global_services: {
        Row: {
          created_at: string
          id: string
          service_id: string
          studio_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          service_id: string
          studio_id: string
        }
        Update: {
          created_at?: string
          id?: string
          service_id?: string
          studio_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_global_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_global_services_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_reviews: {
        Row: {
          booking_id: string | null
          comment: string | null
          created_at: string
          id: string
          rating: number
          studio_id: string
          user_id: string
        }
        Insert: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          studio_id: string
          user_id: string
        }
        Update: {
          booking_id?: string | null
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          studio_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_reviews_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "studio_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_reviews_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_services: {
        Row: {
          category: string
          created_at: string
          description: string | null
          duration_hours: number | null
          id: string
          is_active: boolean
          price: number | null
          sort_order: number
          studio_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          price?: number | null
          sort_order?: number
          studio_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          id?: string
          is_active?: boolean
          price?: number | null
          sort_order?: number
          studio_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_services_studio_id_fkey"
            columns: ["studio_id"]
            isOneToOne: false
            referencedRelation: "studios"
            referencedColumns: ["id"]
          },
        ]
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
      studios: {
        Row: {
          address: string | null
          amenities: string[] | null
          category: string
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          currency: string
          daily_rate: number | null
          description: string | null
          equipment: string[] | null
          gallery_urls: string[] | null
          hourly_rate: number
          id: string
          is_active: boolean
          location: string | null
          max_guests: number | null
          name: string
          owner_id: string
          parking_info: string | null
          rating_avg: number | null
          review_count: number | null
          rules: string | null
          short_description: string | null
          show_price: boolean
          state: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          amenities?: string[] | null
          category?: string
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          daily_rate?: number | null
          description?: string | null
          equipment?: string[] | null
          gallery_urls?: string[] | null
          hourly_rate?: number
          id?: string
          is_active?: boolean
          location?: string | null
          max_guests?: number | null
          name: string
          owner_id: string
          parking_info?: string | null
          rating_avg?: number | null
          review_count?: number | null
          rules?: string | null
          short_description?: string | null
          show_price?: boolean
          state?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          amenities?: string[] | null
          category?: string
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          daily_rate?: number | null
          description?: string | null
          equipment?: string[] | null
          gallery_urls?: string[] | null
          hourly_rate?: number
          id?: string
          is_active?: boolean
          location?: string | null
          max_guests?: number | null
          name?: string
          owner_id?: string
          parking_info?: string | null
          rating_avg?: number | null
          review_count?: number | null
          rules?: string | null
          short_description?: string | null
          show_price?: boolean
          state?: string | null
          status?: string
          updated_at?: string
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
      user_buddies: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["buddy_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["buddy_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["buddy_status"]
          updated_at?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          created_at: string
          id: string
          last_reward_login: string | null
          reward_streak: number
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
          last_reward_login?: string | null
          reward_streak?: number
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
          last_reward_login?: string | null
          reward_streak?: number
          subscription_end?: string | null
          subscription_start?: string | null
          tier?: string
          tier_credits_monthly?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          body: string
          created_at: string
          expires_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          expires_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          expires_at?: string
          id?: string
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
      user_streaks: {
        Row: {
          current_streak: number
          last_active_at: string | null
          last_milestone_at: string | null
          longest_streak: number
          updated_at: string
          user_id: string
        }
        Insert: {
          current_streak?: number
          last_active_at?: string | null
          last_milestone_at?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          current_streak?: number
          last_active_at?: string | null
          last_milestone_at?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      wallet_change_requests: {
        Row: {
          admin_note: string | null
          created_at: string
          current_wallet: string
          id: string
          processed_at: string | null
          processed_by: string | null
          reason: string | null
          requested_wallet: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          created_at?: string
          current_wallet: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_wallet: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          created_at?: string
          current_wallet?: string
          id?: string
          processed_at?: string | null
          processed_by?: string | null
          reason?: string | null
          requested_wallet?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      withdrawal_requests: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          id: string
          payout_details: Json | null
          payout_method: string
          processed_at: string | null
          processed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string
          processed_at?: string | null
          processed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      work_attachments: {
        Row: {
          attached_by: string
          created_at: string
          id: string
          note: string | null
          role: string
          target_id: string
          target_type: string
          work_id: string
        }
        Insert: {
          attached_by: string
          created_at?: string
          id?: string
          note?: string | null
          role?: string
          target_id: string
          target_type: string
          work_id: string
        }
        Update: {
          attached_by?: string
          created_at?: string
          id?: string
          note?: string | null
          role?: string
          target_id?: string
          target_type?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_attachments_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      work_verification_requests: {
        Row: {
          applicant_id: string
          applicant_note: string | null
          created_at: string
          decided_at: string | null
          id: string
          review_note: string | null
          reviewer_id: string | null
          status: string
          supporting_urls: string[]
          updated_at: string
          work_id: string
        }
        Insert: {
          applicant_id: string
          applicant_note?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          review_note?: string | null
          reviewer_id?: string | null
          status?: string
          supporting_urls?: string[]
          updated_at?: string
          work_id: string
        }
        Update: {
          applicant_id?: string
          applicant_note?: string | null
          created_at?: string
          decided_at?: string | null
          id?: string
          review_note?: string | null
          reviewer_id?: string | null
          status?: string
          supporting_urls?: string[]
          updated_at?: string
          work_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_verification_requests_work_id_fkey"
            columns: ["work_id"]
            isOneToOne: false
            referencedRelation: "works"
            referencedColumns: ["id"]
          },
        ]
      }
      works: {
        Row: {
          anchored_at: string | null
          content_hash: string
          created_at: string
          description: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          gating: Json | null
          id: string
          is_unverified: boolean
          kind: string
          mime_type: string | null
          solana_signature: string | null
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          anchored_at?: string | null
          content_hash: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          gating?: Json | null
          id?: string
          is_unverified?: boolean
          kind?: string
          mime_type?: string | null
          solana_signature?: string | null
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          anchored_at?: string | null
          content_hash?: string
          created_at?: string
          description?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          gating?: Json | null
          id?: string
          is_unverified?: boolean
          kind?: string
          mime_type?: string | null
          solana_signature?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: []
      }
    }
    Views: {
      profiles_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _coin_drops_remaining: { Args: { _user: string }; Returns: number }
      adjust_user_credits: {
        Args: {
          _amount: number
          _description: string
          _payment_method?: string
          _type: string
          _user_id: string
        }
        Returns: undefined
      }
      approve_pending_reward: {
        Args: { _admin_id: string; _note?: string; _reward_id: string }
        Returns: undefined
      }
      approve_pending_rewards_batch: {
        Args: { _admin_id: string; _reward_ids: string[] }
        Returns: number
      }
      approve_work_verification: {
        Args: {
          _request_id: string
          _review_note?: string
          _solana_signature: string
        }
        Returns: undefined
      }
      are_buddies: { Args: { _a: string; _b: string }; Returns: boolean }
      award_engagement_reward: {
        Args: {
          _action_type: string
          _description?: string
          _reference_id?: string
          _user_id: string
        }
        Returns: Json
      }
      award_rhoze: {
        Args: { _amount: number; _description: string; _user_id: string }
        Returns: undefined
      }
      can_manage_event: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_project: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_smartboard_file: {
        Args: { _file_path: string; _user_id: string }
        Returns: boolean
      }
      cancel_coin_launch: { Args: { _launch_id: string }; Returns: undefined }
      check_username_available: {
        Args: { _username: string }
        Returns: boolean
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      complete_project_early: {
        Args: { _contract_id: string; _reason?: string; _requester_id: string }
        Returns: undefined
      }
      convert_inquiry_to_project: {
        Args: {
          _inquiry_id: string
          _receiver_id: string
          _total_credits?: number
        }
        Returns: Json
      }
      create_coin_launch: {
        Args: {
          _creator_fee_bps?: number
          _description?: string
          _image_url?: string
          _lp_lock_months?: number
          _name: string
          _platform_fee_bps?: number
          _ticker: string
          _work_id: string
        }
        Returns: string
      }
      create_drop_coin_launch: {
        Args: {
          _creator_fee_bps?: number
          _description?: string
          _event_id?: string
          _image_url?: string
          _lp_lock_months?: number
          _name: string
          _platform_fee_bps?: number
          _space_id?: string
          _ticker: string
        }
        Returns: string
      }
      create_profile_coin_launch: {
        Args: {
          _creator_fee_bps?: number
          _description?: string
          _image_url?: string
          _lp_lock_months?: number
          _name: string
          _platform_fee_bps?: number
          _ticker: string
        }
        Returns: string
      }
      create_project_with_owner: {
        Args: {
          _cover_color?: string
          _description?: string
          _project_type?: string
          _scope_of_work?: string
          _status?: string
          _title: string
          _vision?: string
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "projects"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_rhoze_vanity_address: { Args: never; Returns: string }
      get_active_underwriting_rules: {
        Args: never
        Returns: {
          advance_cap: number
          anchored_score_per_work: number
          base_advance_ratio: number
          diversification_floor_per_work: number
          min_advance_amount: number
          min_anchored_works: number
          min_settled_events: number
          provenance_bonus_max: number
          revenue_score_target: number
          score_weight_anchored: number
          score_weight_provenance: number
          score_weight_revenue: number
          score_weight_tenure: number
          tenure_floor_mult: number
          tenure_full_months: number
        }[]
      }
      get_host_fiat_earnings: {
        Args: { _host_id: string }
        Returns: {
          available: number
          currency_code: string
          gross: number
          host_net: number
          paid_payouts: number
          pending_payouts: number
          platform_fee: number
          ticket_count: number
        }[]
      }
      get_platform_fee_bps: { Args: { _user_id: string }; Returns: number }
      get_profiles_by_ids: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_public_profile: {
        Args: { _user_id: string }
        Returns: {
          available: boolean
          avatar_url: string
          banner_gradient: string
          banner_url: string
          bio: string
          created_at: string
          display_name: string
          headline: string
          id: string
          instagram_url: string
          is_public: boolean
          location: string
          mediums: string[]
          portfolio_url: string
          profile_background: string
          profile_layout: Json
          show_flow_posts: boolean
          show_offerings: boolean
          show_public_boards: boolean
          show_seller_stats: boolean
          skills: string[]
          tiktok_url: string
          twitter_url: string
          updated_at: string
          user_id: string
          username: string
          wallet_address: string
          youtube_url: string
        }[]
      }
      get_user_token_holding: {
        Args: { _launch_id: string; _user_id: string }
        Returns: number
      }
      has_event_ticket: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
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
      is_event_host: {
        Args: { _event_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      is_split_collaborator: {
        Args: { _config_id: string; _user_id: string }
        Returns: boolean
      }
      is_verified_artist: { Args: { _user_id: string }; Returns: boolean }
      list_my_buddies: {
        Args: never
        Returns: {
          avatar_url: string
          buddied_at: string
          buddy_id: string
          display_name: string
          note_body: string
          note_expires_at: string
          username: string
        }[]
      }
      lock_escrow_credits: {
        Args: { _amount: number; _client_id: string; _contract_id: string }
        Returns: undefined
      }
      lock_split_config: {
        Args: { _config_id: string }
        Returns: {
          buyback_pct: number | null
          buyback_wallet: string | null
          contract_id: string | null
          created_at: string
          creator_id: string
          creator_pct: number | null
          curator_id: string | null
          curator_pct: number | null
          id: string
          is_active: boolean
          listing_id: string | null
          locked_at: string | null
          locked_platform_fee_bps: number | null
          splits_hash: string | null
          updated_at: string
          work_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "revenue_split_configs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      lookup_user_by_display_name: {
        Args: { _name: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
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
      process_streaks_and_holds: { Args: never; Returns: Json }
      process_wallet_change: {
        Args: {
          _admin_id: string
          _approve: boolean
          _note?: string
          _request_id: string
        }
        Returns: undefined
      }
      process_withdrawal: {
        Args: {
          _admin_id: string
          _new_status: string
          _note?: string
          _request_id: string
        }
        Returns: undefined
      }
      project_member_role: {
        Args: { _project_id: string; _user_id: string }
        Returns: string
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
      reject_pending_reward: {
        Args: { _admin_id: string; _note?: string; _reward_id: string }
        Returns: undefined
      }
      reject_work_verification: {
        Args: {
          _changes_requested?: boolean
          _request_id: string
          _review_note: string
        }
        Returns: undefined
      }
      release_milestone_credits: {
        Args: { _approver_id: string; _milestone_id: string }
        Returns: undefined
      }
      request_host_payout: {
        Args: {
          _amount: number
          _currency_code: string
          _payout_details?: Json
          _payout_method: string
        }
        Returns: string
      }
      request_withdrawal: {
        Args: {
          _amount: number
          _payout_details?: Json
          _payout_method: string
          _user_id: string
        }
        Returns: string
      }
      request_work_unlock: { Args: { _work_id: string }; Returns: Json }
      reward_already_granted: {
        Args: { _action_type: string; _reference_id?: string; _user_id: string }
        Returns: boolean
      }
      reward_daily_cap_hit: {
        Args: { _action_type: string; _cap: number; _user_id: string }
        Returns: boolean
      }
      reward_weekly_cap_hit: {
        Args: { _action_type: string; _cap: number; _user_id: string }
        Returns: boolean
      }
      simulate_coin_trade: {
        Args: { _amount: number; _launch_id: string; _side: string }
        Returns: Json
      }
      submit_work_verification: {
        Args: {
          _applicant_note?: string
          _supporting_urls?: string[]
          _work_id: string
        }
        Returns: string
      }
      swap_rhoze_for_coin: {
        Args: {
          _amount: number
          _launch_id: string
          _min_out?: number
          _side: string
        }
        Returns: Json
      }
      tick_reward_streak: {
        Args: never
        Returns: {
          awarded_bonus: boolean
          last_reward_login: string
          reward_streak: number
        }[]
      }
      touch_user_activity: { Args: { _user_id: string }; Returns: undefined }
      update_platform_fee_tiers: {
        Args: { _payload: Json }
        Returns: undefined
      }
      update_underwriting_rules: {
        Args: { _payload: Json }
        Returns: undefined
      }
      update_user_subscription: {
        Args: {
          _description: string
          _payment_method?: string
          _subscription_end: string
          _subscription_start: string
          _tier: string
          _tier_credits_monthly: number
          _user_id: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      buddy_status: "pending" | "accepted" | "blocked"
      capital_advance_status:
        | "submitted"
        | "under_review"
        | "approved"
        | "funded"
        | "rejected"
        | "cancelled"
      event_collaborator_role: "co_host" | "manager"
      event_collaborator_status: "pending" | "accepted" | "declined"
      event_purchase_currency: "usd" | "rhoze" | "free"
      event_status: "draft" | "published" | "cancelled" | "completed"
      event_ticket_status:
        | "issued"
        | "checked_in"
        | "refunded"
        | "cancelled"
        | "pending_approval"
        | "declined"
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
      buddy_status: ["pending", "accepted", "blocked"],
      capital_advance_status: [
        "submitted",
        "under_review",
        "approved",
        "funded",
        "rejected",
        "cancelled",
      ],
      event_collaborator_role: ["co_host", "manager"],
      event_collaborator_status: ["pending", "accepted", "declined"],
      event_purchase_currency: ["usd", "rhoze", "free"],
      event_status: ["draft", "published", "cancelled", "completed"],
      event_ticket_status: [
        "issued",
        "checked_in",
        "refunded",
        "cancelled",
        "pending_approval",
        "declined",
      ],
    },
  },
} as const
