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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
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
          cooldown_seconds: number
          created_at: string
          created_by: string | null
          daily_limit: number
          id: string
          is_active: boolean
          keywords: string[]
          match_type: Database["public"]["Enums"]["automation_match"]
          name: string
          organization_id: string
          platform: Database["public"]["Enums"]["social_platform"] | null
          priority: number
          response_text: string | null
          response_variations: string[]
          set_status: Database["public"]["Enums"]["conversation_status"] | null
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at: string
        }
        Insert: {
          action: Database["public"]["Enums"]["automation_action"]
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: Database["public"]["Enums"]["automation_match"]
          name: string
          organization_id: string
          platform?: Database["public"]["Enums"]["social_platform"] | null
          priority?: number
          response_text?: string | null
          response_variations?: string[]
          set_status?: Database["public"]["Enums"]["conversation_status"] | null
          trigger: Database["public"]["Enums"]["automation_trigger"]
          updated_at?: string
        }
        Update: {
          action?: Database["public"]["Enums"]["automation_action"]
          cooldown_seconds?: number
          created_at?: string
          created_by?: string | null
          daily_limit?: number
          id?: string
          is_active?: boolean
          keywords?: string[]
          match_type?: Database["public"]["Enums"]["automation_match"]
          name?: string
          organization_id?: string
          platform?: Database["public"]["Enums"]["social_platform"] | null
          priority?: number
          response_text?: string | null
          response_variations?: string[]
          set_status?: Database["public"]["Enums"]["conversation_status"] | null
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
          blocked_keywords: string[]
          created_at: string
          is_paused: boolean
          opt_out_keywords: string[]
          organization_id: string
          per_contact_daily_limit: number
          quiet_hours_enabled: boolean
          quiet_hours_end: number
          quiet_hours_start: number
          timezone_offset_minutes: number
          updated_at: string
        }
        Insert: {
          blocked_keywords?: string[]
          created_at?: string
          is_paused?: boolean
          opt_out_keywords?: string[]
          organization_id: string
          per_contact_daily_limit?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone_offset_minutes?: number
          updated_at?: string
        }
        Update: {
          blocked_keywords?: string[]
          created_at?: string
          is_paused?: boolean
          opt_out_keywords?: string[]
          organization_id?: string
          per_contact_daily_limit?: number
          quiet_hours_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone_offset_minutes?: number
          updated_at?: string
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
          created_at: string
          id: string
          name: string
          owner_id: string
          plan: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          plan?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          plan?: string
          slug?: string
          updated_at?: string
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
      has_org_role: {
        Args: {
          _org_id: string
          _roles: Database["public"]["Enums"]["org_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_platform_role: {
        Args: {
          _role: Database["public"]["Enums"]["platform_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_unread: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
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
      automation_trigger: "dm_received" | "comment_received"
      conversation_status: "open" | "pending" | "resolved"
      message_direction: "inbound" | "outbound"
      org_role: "owner" | "admin" | "manager" | "agent" | "viewer"
      platform_role: "super_admin" | "support"
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
      automation_trigger: ["dm_received", "comment_received"],
      conversation_status: ["open", "pending", "resolved"],
      message_direction: ["inbound", "outbound"],
      org_role: ["owner", "admin", "manager", "agent", "viewer"],
      platform_role: ["super_admin", "support"],
      social_account_status: ["connected", "attention", "disconnected"],
      social_platform: ["instagram", "facebook", "youtube"],
      webhook_status: ["received", "processed", "failed", "ignored"],
    },
  },
} as const
