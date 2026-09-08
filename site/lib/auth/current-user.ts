import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Middleware já garante que só chega aqui autenticado, mas mantemos o
// redirect como defesa extra pra qualquer chamada direta a essa função.
export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

  if (!profile) redirect("/login");

  return { supabase, user, profile };
}
