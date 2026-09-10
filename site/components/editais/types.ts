import type { Database, EditalFase } from "@/lib/supabase/types";

export type EditalRow = Database["public"]["Tables"]["editais"]["Row"];
export type { EditalFase };
