import type { Database, ItemStatus, SharePermission } from "@/lib/supabase/types";

export type PlanoRow = Database["public"]["Tables"]["planos"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["plano_categories"]["Row"];
export type ItemRow = Database["public"]["Tables"]["plano_items"]["Row"];
export type PlanoDayRow = Database["public"]["Tables"]["plano_days"]["Row"];

export type TeamProfile = { id: string; full_name: string | null; email: string };

export type ShareEntry = {
  id: string;
  permission: SharePermission;
  profile: TeamProfile;
};

export type { ItemStatus, SharePermission };
