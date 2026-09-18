export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      comments: {
        Row: {
          author_id: string
          body: NonNullable<Json>
          body_text: string
          created_at: string
          id: string
          page_id: string
          parent_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          updated_at: string
        }
        Insert: {
          author_id: string
          body: NonNullable<Json>
          body_text: string
          created_at?: string
          id?: string
          page_id: string
          parent_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: NonNullable<Json>
          body_text?: string
          created_at?: string
          id?: string
          page_id?: string
          parent_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "comments_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_resolved_by_fkey"
            columns: ["resolved_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_resolved_by_fkey"
            columns: ["resolved_by"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
        ]
      }
      mentions: {
        Row: {
          author_id: string
          comment_id: string | null
          context: string | null
          created_at: string
          id: string
          mentioned_id: string
          page_id: string
          read_at: string | null
        }
        Insert: {
          author_id: string
          comment_id?: string | null
          context?: string | null
          created_at?: string
          id?: string
          mentioned_id: string
          page_id: string
          read_at?: string | null
        }
        Update: {
          author_id?: string
          comment_id?: string | null
          context?: string | null
          created_at?: string
          id?: string
          mentioned_id?: string
          page_id?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mentions_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "mentions_comment_id_fkey"
            columns: ["comment_id"]
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_mentioned_id_fkey"
            columns: ["mentioned_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_mentioned_id_fkey"
            columns: ["mentioned_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "mentions_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          page_id: string | null
          preview: string | null
          push_error: string | null
          pushed_at: string | null
          read_at: string | null
          recipient_id: string
          title: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          page_id?: string | null
          preview?: string | null
          push_error?: string | null
          pushed_at?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          page_id?: string | null
          preview?: string | null
          push_error?: string | null
          pushed_at?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "notifications_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
        ]
      }
      org_snapshots: {
        Row: {
          company: string | null
          created_at: string
          division: string | null
          effective_from: string
          effective_to: string | null
          id: string
          manager_id: string | null
          profile_id: string
          team: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          division?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          manager_id?: string | null
          profile_id: string
          team?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          division?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          manager_id?: string | null
          profile_id?: string
          team?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_snapshots_manager_id_fkey"
            columns: ["manager_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_snapshots_manager_id_fkey"
            columns: ["manager_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "org_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_snapshots_profile_id_fkey"
            columns: ["profile_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
        ]
      }
      page_updates: {
        Row: {
          author_id: string
          blocker: string | null
          content: string
          created_at: string
          id: string
          page_id: string
          progress_snapshot: number | null
          status_snapshot: string | null
        }
        Insert: {
          author_id: string
          blocker?: string | null
          content: string
          created_at?: string
          id?: string
          page_id: string
          progress_snapshot?: number | null
          status_snapshot?: string | null
        }
        Update: {
          author_id?: string
          blocker?: string | null
          content?: string
          created_at?: string
          id?: string
          page_id?: string
          progress_snapshot?: number | null
          status_snapshot?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_updates_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_author_id_fkey"
            columns: ["author_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          archived_at: string | null
          assignee_id: string | null
          completed_at: string | null
          content: Json | null
          created_at: string
          created_by: string
          depth: number
          due_date: string | null
          icon: string | null
          id: string
          parent_id: string | null
          path: unknown
          priority: string | null
          progress: number | null
          sort_order: number
          start_date: string | null
          status: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          assignee_id?: string | null
          completed_at?: string | null
          content?: Json | null
          created_at?: string
          created_by: string
          depth?: number
          due_date?: string | null
          icon?: string | null
          id?: string
          parent_id?: string | null
          path?: unknown
          priority?: string | null
          progress?: number | null
          sort_order?: number
          start_date?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          assignee_id?: string | null
          completed_at?: string | null
          content?: Json | null
          created_at?: string
          created_by?: string
          depth?: number
          due_date?: string | null
          icon?: string | null
          id?: string
          parent_id?: string | null
          path?: unknown
          priority?: string | null
          progress?: number | null
          sort_order?: number
          start_date?: string | null
          status?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pages_assignee_id_fkey"
            columns: ["assignee_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_assignee_id_fkey"
            columns: ["assignee_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "pages_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deactivated_at: string | null
          email: string | null
          id: string
          is_admin: boolean
          job_title: string | null
          name: string
          naverworks_id: string | null
          notify_assign: boolean
          notify_due: boolean
          notify_mention: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          id: string
          is_admin?: boolean
          job_title?: string | null
          name: string
          naverworks_id?: string | null
          notify_assign?: boolean
          notify_due?: boolean
          notify_mention?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deactivated_at?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean
          job_title?: string | null
          name?: string
          naverworks_id?: string | null
          notify_assign?: boolean
          notify_due?: boolean
          notify_mention?: boolean
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_activity_feed: {
        Row: {
          author_name: string | null
          avatar_url: string | null
          blocker: string | null
          content: string | null
          created_at: string | null
          icon: string | null
          id: string | null
          page_id: string | null
          page_title: string | null
          progress_snapshot: number | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      v_assignee_summary: {
        Row: {
          assignee_id: string | null
          avatar_url: string | null
          avg_progress: number | null
          done_count: number | null
          in_progress: number | null
          name: string | null
          on_hold: number | null
          open_count: number | null
          overdue: number | null
        }
        Relationships: []
      }
      v_blocked_tasks: {
        Row: {
          assignee_name: string | null
          blocker: string | null
          icon: string | null
          id: string | null
          progress: number | null
          raised_at: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      v_due_risk: {
        Row: {
          assignee_name: string | null
          avatar_url: string | null
          days_left: number | null
          due_date: string | null
          icon: string | null
          id: string | null
          priority: string | null
          progress: number | null
          risk_level: string | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
      v_page_tree: {
        Row: {
          depth: number | null
          has_children: boolean | null
          icon: string | null
          id: string | null
          parent_id: string | null
          path: unknown
          sort_order: number | null
          status: string | null
          title: string | null
          type: string | null
        }
        Insert: {
          depth?: number | null
          has_children?: never
          icon?: string | null
          id?: string | null
          parent_id?: string | null
          path?: unknown
          sort_order?: number | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Update: {
          depth?: number | null
          has_children?: never
          icon?: string | null
          id?: string | null
          parent_id?: string | null
          path?: unknown
          sort_order?: number | null
          status?: string | null
          title?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stale_tasks: {
        Row: {
          assignee_name: string | null
          avatar_url: string | null
          due_date: string | null
          icon: string | null
          id: string | null
          last_activity_at: string | null
          progress: number | null
          stale_days: number | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      dearmor: { Args: { "": string }; Returns: string }
      enqueue_notification: {
        Args: {
          p_actor: string
          p_dedupe_key?: string
          p_kind: string
          p_page_id: string
          p_preview?: string
          p_recipient: string
          p_title: string
        }
        Returns: string
      }
      gen_random_uuid: { Args: Record<PropertyKey, never>; Returns: string }
      gen_salt: { Args: { "": string }; Returns: string }
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
      mark_notifications_read: { Args: { p_ids?: string[] }; Returns: number }
      move_page: {
        Args: { p_after_id?: string; p_page_id: string; p_parent_id: string }
        Returns: number
      }
      page_label: { Args: { p_id: string }; Returns: string }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      silent_members: {
        Args: { p_days?: number }
        Returns: {
          last_log_at: string
          name: string
          open_tasks: number
          profile_id: string
        }[]
      }
      sync_comment_mentions: {
        Args: { p_comment_id: string; p_mentioned: string[] }
        Returns: number
      }
      sync_page_mentions: {
        Args: {
          p_author_id: string
          p_contexts?: Json
          p_mentioned: string[]
          p_page_id: string
        }
        Returns: number
      }
      text2ltree: { Args: { "": string }; Returns: unknown }
      weekly_digest: {
        Args: { p_days?: number }
        Returns: {
          assignee_name: string
          author_name: string
          blockers: string
          page_status: string
          page_title: string
          progress: number
          updates: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
