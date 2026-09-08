// Tipos escritos à mão pra bater com supabase/migrations/*.sql,
// incluindo os `Relationships` que o supabase-js usa pra tipar selects
// aninhados (ex: `.select("planos(title)")`). Quando o projeto
// Supabase real existir, pode substituir esse arquivo pelo gerado
// automaticamente: `npx supabase gen types typescript`.

export type PlanoItemContent = {
  texto?: string;
  data_prazo?: string | null;
  link?: string | null;
  responsavel?: string | null;
};

export type ItemStatus = "pendente" | "em_andamento" | "concluido" | "urgente";
export type SharePermission = "view" | "edit";
export type ProfileRole = "member" | "manager";
export type NotificationType =
  | "mention"
  | "comment_reply"
  | "deadline_reminder"
  | "daily_digest"
  | "share_granted";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string;
          avatar_url: string | null;
          role: ProfileRole;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string; email: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      planos: {
        Row: {
          id: string;
          owner_id: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["planos"]["Row"]> & { owner_id: string };
        Update: Partial<Database["public"]["Tables"]["planos"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "planos_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planos_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plano_categories: {
        Row: {
          id: string;
          plano_id: string;
          code: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plano_categories"]["Row"]> & {
          plano_id: string;
          code: string;
          label: string;
        };
        Update: Partial<Database["public"]["Tables"]["plano_categories"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "plano_categories_plano_id_fkey";
            columns: ["plano_id"];
            isOneToOne: false;
            referencedRelation: "planos";
            referencedColumns: ["id"];
          },
        ];
      };
      plano_items: {
        Row: {
          id: string;
          plano_id: string;
          category_id: string;
          item_number: number;
          content: PlanoItemContent;
          deadline_at: string | null;
          status: ItemStatus;
          sort_order: number;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plano_items"]["Row"]> & {
          plano_id: string;
          category_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["plano_items"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "plano_items_plano_id_fkey";
            columns: ["plano_id"];
            isOneToOne: false;
            referencedRelation: "planos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plano_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "plano_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      plano_shares: {
        Row: {
          id: string;
          plano_id: string;
          user_id: string;
          permission: SharePermission;
          granted_by: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["plano_shares"]["Row"]> & {
          plano_id: string;
          user_id: string;
          permission: SharePermission;
        };
        Update: Partial<Database["public"]["Tables"]["plano_shares"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "plano_shares_plano_id_fkey";
            columns: ["plano_id"];
            isOneToOne: false;
            referencedRelation: "planos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plano_shares_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      time_logs: {
        Row: {
          id: string;
          user_id: string;
          clock_in_at: string;
          clock_out_at: string | null;
          last_seen_at: string;
          end_reason: "logout" | "timeout" | "still_open";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["time_logs"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["time_logs"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "time_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      comments: {
        Row: {
          id: string;
          plano_id: string;
          plano_item_id: string | null;
          category_id: string | null;
          author_id: string;
          body: string;
          mentioned_user_ids: string[];
          parent_comment_id: string | null;
          resolved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["comments"]["Row"]> & {
          plano_id: string;
          author_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "comments_plano_id_fkey";
            columns: ["plano_id"];
            isOneToOne: false;
            referencedRelation: "planos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_plano_item_id_fkey";
            columns: ["plano_item_id"];
            isOneToOne: false;
            referencedRelation: "plano_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          body: string | null;
          link_path: string | null;
          source_comment_id: string | null;
          source_plano_item_id: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          user_id: string;
          type: NotificationType;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_preferences: {
        Row: {
          user_id: string;
          email_enabled: boolean;
          digest_enabled: boolean;
          whatsapp_enabled: boolean;
          phone_number: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notification_preferences"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["notification_preferences"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_deliveries: {
        Row: {
          id: string;
          notification_id: string;
          channel: "inapp" | "email" | "whatsapp";
          status: "pending" | "sent" | "failed" | "skipped";
          sent_at: string | null;
          error: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["notification_deliveries"]["Row"]> & {
          notification_id: string;
          channel: "inapp" | "email" | "whatsapp";
        };
        Update: Partial<Database["public"]["Tables"]["notification_deliveries"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      deadline_notifications_log: {
        Row: { plano_item_id: string; days_before: number; sent_on: string };
        Insert: Database["public"]["Tables"]["deadline_notifications_log"]["Row"];
        Update: Partial<Database["public"]["Tables"]["deadline_notifications_log"]["Row"]>;
        Relationships: [
          {
            foreignKeyName: "deadline_notifications_log_plano_item_id_fkey";
            columns: ["plano_item_id"];
            isOneToOne: false;
            referencedRelation: "plano_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      daily_hours: {
        Row: { user_id: string; day: string; worked: unknown };
        Relationships: [
          {
            foreignKeyName: "time_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      monthly_hours: {
        Row: { user_id: string; month: string; worked: unknown };
        Relationships: [
          {
            foreignKeyName: "time_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      time_logs_effective: {
        Row: Database["public"]["Tables"]["time_logs"]["Row"] & { effective_clock_out: string | null };
        Relationships: [
          {
            foreignKeyName: "time_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
