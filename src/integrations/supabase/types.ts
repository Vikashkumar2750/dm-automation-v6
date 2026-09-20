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
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
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
      org_role: ["owner", "admin", "manager", "agent", "viewer"],
      platform_role: ["super_admin", "support"],
      social_account_status: ["connected", "attention", "disconnected"],
      social_platform: ["instagram", "facebook", "youtube"],
      webhook_status: ["received", "processed", "failed", "ignored"],
    },
  },
} as const
