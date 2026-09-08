"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { TIME_LOG_SESSION_STORAGE_KEY } from "@/lib/time/session";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const timeLogId = sessionStorage.getItem(TIME_LOG_SESSION_STORAGE_KEY);

    await fetch("/api/time/clock-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ time_log_id: timeLogId }),
    });

    sessionStorage.removeItem(TIME_LOG_SESSION_STORAGE_KEY);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loading}>
      <LogOut className="size-4" />
      Sair
    </Button>
  );
}
