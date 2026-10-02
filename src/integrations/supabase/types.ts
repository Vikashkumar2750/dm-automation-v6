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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_assistant_usage: {
        Row: {
          created_at: string
          feature: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_daily: {
        Row: {
          day: string
          requests: number
          user_id: string
        }
        Insert: {
          day?: string
          requests?: number
          user_id: string
        }
        Update: {
          day?: string
          requests?: number
          user_id?: string
        }
        Relationships: []
      }
      automation_follow_gates: {
        Row: {
          attempts: number
          comment_external_id: string | null
          completed_at: string | null
          conversation_id: string | null
          created_at: string
          external_user_id: string
          id: string
          last_checked_at: string | null
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          rule_id: string | null
          social_account_id: string | null
          status: string
        }
        Insert: {
          attempts?: number
          comment_external_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          external_user_id: string
          id?: string
          last_checked_at?: string | null
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          rule_id?: string | null
          social_account_id?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          comment_external_id?: string | null
          completed_at?: string | null
          conversation_id?: string | null
          created_at?: string
          external_user_id?: string
          id?: string
          last_checked_at?: string | null
          organization_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          rule_id?: string | null
          social_account_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_follow_gates_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_follow_gates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_follow_gates_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_follow_gates_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_opt_outs: {
        Row: {
          created_at: string
          external_user_id: string
          id: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          reason: string | null
        }
        Insert: {
          created_at?: string
          external_user_id: string
          id?: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          reason?: string | null
        }
        Update: {
          created_at?: string
          external_user_id?: string
          id?: string
          organization_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_opt_outs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action: Database["public"]["Enums"]["automation_action"]
          comment_reply_text: string | null
          comment_reply_variations: string[]
          cooldown_seconds: number
          created_at: string
          created_by: string | null
          daily_limit: number
          dm_attachment_type: string
          dm_attachment_url: string | null
          dm_button_label: string | null
          dm_link_url: string | null
          follow_prompt_text: string | null
          follower_condition: string
          id: string
          is_active: boolean
          keywords: string[]
          match_type: Database["public"]["Enums"]["automation_match"]
          name: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"] | null
          priority: number
          require_follow: boolean
          response_text: string | null
          response_variations: string[]
          set_status: Database["public"]["Enums"]["conversation_status"] | null
          target_post_ids: string[]
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["automation_action"]
          comment_reply_text?: string | null
          comment_reply_variations?: string[]
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          dm_attachment_type?: string
          dm_attachment_url?: string | null
          dm_button_label?: string | null
          dm_link_url?: string | null
          follow_prompt_text?: string | null
          follower_condition?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: Database["public"]["Enums"]["automation_match"]
          name: string
          organization_id: string
          platform?: Database["public"]["Enums"]["social_platform"] | null
          priority?: number
          require_follow?: boolean
          response_text?: string | null
          response_variations?: string[]
          set_status?: Database["public"]["Enums"]["conversation_status"] | null
          target_post_ids?: string[]
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["automation_action"]
          comment_reply_text?: string | null
          comment_reply_variations?: string[]
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          dm_attachment_type?: string
          dm_attachment_url?: string | null
          dm_button_label?: string | null
          dm_link_url?: string | null
          follow_prompt_text?: string | null
          follower_condition?: string
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: Database["public"]["Enums"]["automation_match"]
          name?: string
          organization_id?: string
          platform?: Database["public"]["Enums"]["social_platform"] | null
          priority?: number
          require_follow?: boolean
          response_text?: string | null
          response_variations?: string[]
          set_status?: Database["public"]["Enums"]["conversation_status"] | null
          target_post_ids?: string[]
          trigger?: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          conversation_id: string | null
          created_at: string
          detail: string | null
          id: string
          message_id: string | null
          organization_id: string
          rule_id: string | null
          status: Database["public"]["Enums"]["automation_run_status"]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          message_id?: string | null
          organization_id: string
          rule_id?: string | null
          status?: Database["public"]["Enums"]["automation_run_status"]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          message_id?: string | null
          organization_id?: string
          rule_id?: string | null
          status?: Database["public"]["Enums"]["automation_run_status"]
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_settings: {
        Row: {
          auto_pause_reason: string | null
          auto_paused_until: string | null
          blocked_keywords: string[]
          created_at: string
          daily_send_limit: number
          hourly_send_limit: number
          is_paused: boolean
          opt_out_keywords: string[]
          organization_id: string
          per_contact_daily_limit: number
          quiet_hours_enabled: boolean
          quiet_hours_end: number
          quiet_hours_start: number
          timezone_offset_minutes: number
          updated_at: string
          viral_cooldown_minutes: number
          viral_guard_enabled: boolean
          viral_threshold_per_minute: number
        }
        Insert: {
          auto_pause_reason?: string | null
          auto_paused_until?: string | null
          blocked_keywords?: string[]
          created_at?: string
          daily_send_limit?: number
          hourly_send_limit?: number
          is_paused?: boolean
          opt_out_keywords?: string[]
          organization_id: string
          per_contact_daily_limit?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone_offset_minutes?: number
          updated_at?: string
          viral_cooldown_minutes?: number
          viral_guard_enabled?: boolean
          viral_threshold_per_minute?: number
        }
        Update: {
          auto_pause_reason?: string | null
          auto_paused_until?: string | null
          blocked_keywords?: string[]
          created_at?: string
          daily_send_limit?: number
          hourly_send_limit?: number
          is_paused?: boolean
          opt_out_keywords?: string[]
          organization_id?: string
          per_contact_daily_limit?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone_offset_minutes?: number
          updated_at?: string
          viral_cooldown_minutes?: number
          viral_guard_enabled?: boolean
          viral_threshold_per_minute?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string
          canonical_url: string | null
          category_id: string | null
          content: string
          cover_alt: string | null
          cover_url: string | null
          created_at: string
          excerpt: string
          faq: Json
          focus_keyword: string | null
          id: string
          meta_description: string | null
          noindex: boolean
          published_at: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string
          canonical_url?: string | null
          category_id?: string | null
          content?: string
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          faq?: Json
          focus_keyword?: string | null
          id?: string
          meta_description?: string | null
          noindex?: boolean
          published_at?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string
          canonical_url?: string | null
          category_id?: string | null
          content?: string
          cover_alt?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string
          faq?: Json
          focus_keyword?: string | null
          id?: string
          meta_description?: string | null
          noindex?: boolean
          published_at?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_posts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "blog_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          created_at: string
          external_user_id: string
          id: string
          organization_id: string
          platform: string
          source: string
          tag: string
        }
        Insert: {
          created_at?: string
          external_user_id: string
          id?: string
          organization_id: string
          platform: string
          source?: string
          tag: string
        }
        Update: {
          created_at?: string
          external_user_id?: string
          id?: string
          organization_id?: string
          platform?: string
          source?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_insights: {
        Row: {
          confidence: number
          conversation_id: string | null
          created_at: string
          decision: string
          id: string
          intent: string
          lead_score: number
          message_text: string
          organization_id: string
          provider: string | null
          reply_text: string | null
          sentiment: string
        }
        Insert: {
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          intent?: string
          lead_score?: number
          message_text?: string
          organization_id: string
          provider?: string | null
          reply_text?: string | null
          sentiment?: string
        }
        Update: {
          confidence?: number
          conversation_id?: string | null
          created_at?: string
          decision?: string
          id?: string
          intent?: string
          lead_score?: number
          message_text?: string
          organization_id?: string
          provider?: string | null
          reply_text?: string | null
          sentiment?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_insights_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_insights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel: string
          created_at: string
          external_user_id: string
          external_user_name: string | null
          id: string
          last_message_at: string
          last_message_preview: string | null
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          social_account_id: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          unread_count: number
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          external_user_id: string
          external_user_name?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          social_account_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          external_user_id?: string
          external_user_name?: string | null
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          organization_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          social_account_id?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_runs: {
        Row: {
          conversation_id: string | null
          created_at: string
          detail: string | null
          flow_id: string
          flow_name: string
          id: string
          next_step: number
          organization_id: string
          resume_at: string
          state: Json
          status: string
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          detail?: string | null
          flow_id: string
          flow_name?: string
          id?: string
          next_step?: number
          organization_id: string
          resume_at?: string
          state?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          detail?: string | null
          flow_id?: string
          flow_name?: string
          id?: string
          next_step?: number
          organization_id?: string
          resume_at?: string
          state?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id: string | null
          id: string
          sender_name: string | null
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          sender_name?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          external_id?: string | null
          id?: string
          sender_name?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_states: {
        Row: {
          code_verifier: string | null
          created_at: string
          expires_at: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          redirect_path: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          redirect_path?: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string | null
          created_at?: string
          expires_at?: string
          organization_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          redirect_path?: string
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "oauth_states_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["org_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          brand_color: string | null
          brand_name: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          parent_organization_id: string | null
          plan: string
          plan_expires_at: string | null
          plan_source: string
          slug: string
          support_email: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          brand_color?: string | null
          brand_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          parent_organization_id?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_source?: string
          slug: string
          support_email?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          brand_color?: string | null
          brand_name?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          parent_organization_id?: string | null
          plan?: string
          plan_expires_at?: string | null
          plan_source?: string
          slug?: string
          support_email?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizations_parent_organization_id_fkey"
            columns: ["parent_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_orders: {
        Row: {
          amount_paise: number
          billing_cycle: string
          created_at: string
          created_by: string | null
          currency: string
          error: string | null
          id: string
          mode: string
          organization_id: string
          paid_at: string | null
          plan: string
          provider: string
          provider_order_id: string | null
          provider_payment_id: string | null
          status: string
        }
        Insert: {
          amount_paise: number
          billing_cycle: string
          created_at?: string
          created_by?: string | null
          currency?: string
          error?: string | null
          id?: string
          mode?: string
          organization_id: string
          paid_at?: string | null
          plan: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
        }
        Update: {
          amount_paise?: number
          billing_cycle?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          error?: string | null
          id?: string
          mode?: string
          organization_id?: string
          paid_at?: string | null
          plan?: string
          provider?: string
          provider_order_id?: string | null
          provider_payment_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_audit_log: {
        Row: {
          action: string
          actor_email: string | null
          actor_user_id: string | null
          created_at: string
          detail: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_user_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      platform_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["platform_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["platform_role"]
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          feature_flags: Json
          global_send_paused: boolean
          id: boolean
          incident_banner: string | null
          updated_at: string
        }
        Insert: {
          feature_flags?: Json
          global_send_paused?: boolean
          id?: boolean
          incident_banner?: string | null
          updated_at?: string
        }
        Update: {
          feature_flags?: Json
          global_send_paused?: boolean
          id?: boolean
          incident_banner?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          caption: string
          created_at: string
          created_by: string | null
          error: string | null
          external_post_id: string | null
          group_id: string | null
          id: string
          media_type: string
          media_url: string | null
          media_urls: string[]
          organization_id: string
          permalink: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          post_format: string
          published_at: string | null
          scheduled_at: string | null
          social_account_id: string | null
          status: Database["public"]["Enums"]["post_status"]
          updated_at: string
        }
        Insert: {
          caption?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          external_post_id?: string | null
          group_id?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          media_urls?: string[]
          organization_id: string
          permalink?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          post_format?: string
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Update: {
          caption?: string
          created_at?: string
          created_by?: string | null
          error?: string | null
          external_post_id?: string | null
          group_id?: string | null
          id?: string
          media_type?: string
          media_url?: string | null
          media_urls?: string[]
          organization_id?: string
          permalink?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          post_format?: string
          published_at?: string | null
          scheduled_at?: string | null
          social_account_id?: string | null
          status?: Database["public"]["Enums"]["post_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      social_account_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          refresh_token: string | null
          social_account_id: string
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          refresh_token?: string | null
          social_account_id: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          refresh_token?: string | null
          social_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_account_tokens_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: true
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          avatar_url: string | null
          capabilities: Json
          connected_by: string | null
          created_at: string
          external_id: string
          handle: string | null
          id: string
          last_synced_at: string | null
          metadata: Json
          name: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          scopes: string[]
          status: Database["public"]["Enums"]["social_account_status"]
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          capabilities?: Json
          connected_by?: string | null
          created_at?: string
          external_id: string
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          name: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["social_account_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          capabilities?: Json
          connected_by?: string | null
          created_at?: string
          external_id?: string
          handle?: string | null
          id?: string
          last_synced_at?: string | null
          metadata?: Json
          name?: string
          organization_id?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          scopes?: string[]
          status?: Database["public"]["Enums"]["social_account_status"]
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      support_inquiries: {
        Row: {
          category: string
          created_at: string
          email: string
          email_notification_error: string | null
          email_notification_status: string
          id: string
          message: string
          name: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          email: string
          email_notification_error?: string | null
          email_notification_status?: string
          id?: string
          message: string
          name: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string
          email_notification_error?: string | null
          email_notification_status?: string
          id?: string
          message?: string
          name?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          dedupe_key: string | null
          error: string | null
          event_type: string
          external_account_id: string | null
          id: string
          organization_id: string | null
          payload: Json
          platform: Database["public"]["Enums"]["social_platform"] | null
          processed_at: string | null
          provider: string
          received_at: string
          signature_valid: boolean
          social_account_id: string | null
          status: Database["public"]["Enums"]["webhook_status"]
        }
        Insert: {
          dedupe_key?: string | null
          error?: string | null
          event_type?: string
          external_account_id?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json
          platform?: Database["public"]["Enums"]["social_platform"] | null
          processed_at?: string | null
          provider: string
          received_at?: string
          signature_valid?: boolean
          social_account_id?: string | null
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Update: {
          dedupe_key?: string | null
          error?: string | null
          event_type?: string
          external_account_id?: string | null
          id?: string
          organization_id?: string | null
          payload?: Json
          platform?: Database["public"]["Enums"]["social_platform"] | null
          processed_at?: string | null
          provider?: string
          received_at?: string
          signature_valid?: boolean
          social_account_id?: string | null
          status?: Database["public"]["Enums"]["webhook_status"]
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_ai_request: {
        Args: { _limit: number; _user_id: string }
        Returns: number
      }
      current_user_has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
        }
        Returns: boolean
      }
      current_user_has_platform_role: {
        Args: { _role: Database["public"]["Enums"]["platform_role"] }
        Returns: boolean
      }
      current_user_is_org_member: {
        Args: { _org_id: string }
        Returns: boolean
      }
      increment_unread: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
    }
    Enums: {
      automation_action:
        | "reply_dm"
        | "comment_public_reply"
        | "comment_private_reply"
        | "hide_comment"
        | "set_status"
      automation_match: "any" | "contains" | "exact" | "starts_with"
      automation_run_status: "matched" | "sent" | "skipped" | "failed"
      automation_trigger:
        | "dm_received"
        | "comment_received"
        | "story_reply"
        | "story_mention"
      conversation_status: "open" | "pending" | "resolved"
      message_direction: "inbound" | "outbound"
      org_role: "owner" | "admin" | "manager" | "agent" | "viewer"
      platform_role: "super_admin" | "support"
      post_status: "draft" | "scheduled" | "publishing" | "published" | "failed"
      social_account_status: "connected" | "attention" | "disconnected"
      social_platform: "instagram" | "facebook" | "youtube"
      webhook_status: "received" | "processed" | "failed" | "ignored"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      automation_action: [
        "reply_dm",
        "comment_public_reply",
        "comment_private_reply",
        "hide_comment",
        "set_status",
      ],
      automation_match: ["any", "contains", "exact", "starts_with"],
      automation_run_status: ["matched", "sent", "skipped", "failed"],
      automation_trigger: [
        "dm_received",
        "comment_received",
        "story_reply",
        "story_mention",
      ],
      conversation_status: ["open", "pending", "resolved"],
      message_direction: ["inbound", "outbound"],
      org_role: ["owner", "admin", "manager", "agent", "viewer"],
      platform_role: ["super_admin", "support"],
      post_status: ["draft", "scheduled", "publishing", "published", "failed"],
      social_account_status: ["connected", "attention", "disconnected"],
      social_platform: ["instagram", "facebook", "youtube"],
      webhook_status: ["received", "processed", "failed", "ignored"],
    },
  },
} as const
