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
            referencedRelation: "v_favorite_pages"
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
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_trash"
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
            referencedRelation: "v_favorite_pages"
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
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mentions_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_trash"
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
            referencedRelation: "v_favorite_pages"
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
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_trash"
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
      org_unit_writers: {
        Row: {
          unit_id: string
          user_id: string
        }
        Insert: {
          unit_id: string
          user_id: string
        }
        Update: {
          unit_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_unit_writers_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_unit_writers_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "v_org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_unit_writers_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_unit_writers_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
        ]
      }
      org_units: {
        Row: {
          created_at: string
          id: string
          level: string
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          write_scope: string
        }
        Insert: {
          created_at?: string
          id?: string
          level: string
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          write_scope?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: string
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          write_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      page_favorites: {
        Row: {
          created_at: string
          page_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          page_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          page_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_favorite_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_trash"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
        ]
      }
      page_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          kind: string
          name: string
          sort_order: number
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          kind: string
          name: string
          sort_order?: number
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
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
            referencedRelation: "v_favorite_pages"
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
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_trash"
            referencedColumns: ["id"]
          },
        ]
      }
      page_visits: {
        Row: {
          page_id: string
          user_id: string
          visited_at: string
        }
        Insert: {
          page_id: string
          user_id: string
          visited_at?: string
        }
        Update: {
          page_id?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_blocked_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_due_risk"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_favorite_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_page_tree"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_trash"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
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
          event_date: string | null
          icon: string | null
          id: string
          owner_id: string | null
          parent_id: string | null
          path: unknown
          pinned: boolean
          priority: string | null
          progress: number | null
          search_text: string | null
          sort_order: number
          start_date: string | null
          status: string | null
          template: string | null
          title: string
          type: string
          unit_id: string | null
          updated_at: string
          visibility: string
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
          event_date?: string | null
          icon?: string | null
          id?: string
          owner_id?: string | null
          parent_id?: string | null
          path?: unknown
          pinned?: boolean
          priority?: string | null
          progress?: number | null
          search_text?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string | null
          template?: string | null
          title?: string
          type?: string
          unit_id?: string | null
          updated_at?: string
          visibility?: string
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
          event_date?: string | null
          icon?: string | null
          id?: string
          owner_id?: string | null
          parent_id?: string | null
          path?: unknown
          pinned?: boolean
          priority?: string | null
          progress?: number | null
          search_text?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string | null
          template?: string | null
          title?: string
          type?: string
          unit_id?: string | null
          updated_at?: string
          visibility?: string
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
            foreignKeyName: "pages_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_owner_id_fkey"
            columns: ["owner_id"]
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
            referencedRelation: "v_favorite_pages"
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
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_trash"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "pages_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "v_org_units"
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
          must_change_password: boolean
          name: string
          naverworks_id: string | null
          notify_assign: boolean
          notify_due: boolean
          notify_mention: boolean
          rank: string | null
          unit_id: string | null
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
          must_change_password?: boolean
          name: string
          naverworks_id?: string | null
          notify_assign?: boolean
          notify_due?: boolean
          notify_mention?: boolean
          rank?: string | null
          unit_id?: string | null
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
          must_change_password?: boolean
          name?: string
          naverworks_id?: string | null
          notify_assign?: boolean
          notify_due?: boolean
          notify_mention?: boolean
          rank?: string | null
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "v_org_units"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "v_favorite_pages"
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
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_updates_page_id_fkey"
            columns: ["page_id"]
            referencedRelation: "v_trash"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
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
        Relationships: [
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
          },
        ]
      }
      v_favorite_pages: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string | null
          status: string | null
          title: string | null
          type: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_favorites_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_favorites_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
          },
        ]
      }
      v_org_units: {
        Row: {
          id: string | null
          level: string | null
          member_count: number | null
          name: string | null
          parent_id: string | null
          sort_order: number | null
          write_scope: string | null
        }
        Insert: {
          id?: string | null
          level?: string | null
          member_count?: never
          name?: string | null
          parent_id?: string | null
          sort_order?: number | null
          write_scope?: string | null
        }
        Update: {
          id?: string | null
          level?: string | null
          member_count?: never
          name?: string | null
          parent_id?: string | null
          sort_order?: number | null
          write_scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_units_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_page_tree: {
        Row: {
          depth: number | null
          due_date: string | null
          event_date: string | null
          has_children: boolean | null
          icon: string | null
          id: string | null
          owner_id: string | null
          parent_id: string | null
          path: unknown
          pinned: boolean | null
          sort_order: number | null
          status: string | null
          template: string | null
          title: string | null
          type: string | null
          unit_id: string | null
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          depth?: number | null
          due_date?: string | null
          event_date?: string | null
          has_children?: never
          icon?: string | null
          id?: string | null
          owner_id?: string | null
          parent_id?: string | null
          path?: unknown
          pinned?: boolean | null
          sort_order?: number | null
          status?: string | null
          template?: string | null
          title?: string | null
          type?: string | null
          unit_id?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          depth?: number | null
          due_date?: string | null
          event_date?: string | null
          has_children?: never
          icon?: string | null
          id?: string | null
          owner_id?: string | null
          parent_id?: string | null
          path?: unknown
          pinned?: boolean | null
          sort_order?: number | null
          status?: string | null
          template?: string | null
          title?: string | null
          type?: string | null
          unit_id?: string | null
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pages_owner_id_fkey"
            columns: ["owner_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_owner_id_fkey"
            columns: ["owner_id"]
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
            referencedRelation: "v_favorite_pages"
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
            referencedRelation: "v_recent_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_stale_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "v_trash"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
          },
          {
            foreignKeyName: "pages_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "v_org_units"
            referencedColumns: ["id"]
          },
        ]
      }
      v_recent_pages: {
        Row: {
          icon: string | null
          id: string | null
          status: string | null
          title: string | null
          type: string | null
          user_id: string | null
          visited_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "page_visits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_visits_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "v_assignee_summary"
            referencedColumns: ["assignee_id"]
          },
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
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
        Relationships: [
          {
            foreignKeyName: "pages_status_fk"
            columns: ["status"]
            referencedRelation: "page_statuses"
            referencedColumns: ["name"]
          },
        ]
      }
      v_trash: {
        Row: {
          archived_at: string | null
          created_by: string | null
          descendants: number | null
          icon: string | null
          id: string | null
          title: string | null
          type: string | null
          unit_id: string | null
          visibility: string | null
        }
        Insert: {
          archived_at?: string | null
          created_by?: string | null
          descendants?: never
          icon?: string | null
          id?: string | null
          title?: string | null
          type?: string | null
          unit_id?: string | null
          visibility?: string | null
        }
        Update: {
          archived_at?: string | null
          created_by?: string | null
          descendants?: never
          icon?: string | null
          id?: string | null
          title?: string | null
          type?: string | null
          unit_id?: string | null
          visibility?: string | null
        }
        Relationships: [
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
            foreignKeyName: "pages_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "org_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pages_unit_id_fkey"
            columns: ["unit_id"]
            referencedRelation: "v_org_units"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_unit: { Args: { p_unit: string }; Returns: boolean }
      can_write_unit: { Args: { p_unit: string }; Returns: boolean }
      dearmor: { Args: { "": string }; Returns: string }
      enqueue_daily_reminders: { Args: { p_today?: string }; Returns: number }
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
      my_unit_id: { Args: Record<PropertyKey, never>; Returns: string }
      page_label: { Args: { p_id: string }; Returns: string }
      pgp_armor_headers: {
        Args: { "": string }
        Returns: Record<string, unknown>[]
      }
      restore_page: { Args: { p_id: string }; Returns: number }
      search_pages: {
        Args: { p_limit?: number; p_q: string }
        Returns: {
          icon: string
          id: string
          snippet: string
          template: string
          title: string
          type: string
          unit_id: string
          updated_at: string
          visibility: string
        }[]
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
      status_kind: { Args: { p_status: string }; Returns: string }
      storage_usage_bytes: { Args: Record<PropertyKey, never>; Returns: number }
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
      touch_page_visit: { Args: { p_page_id: string }; Returns: undefined }
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
