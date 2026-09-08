"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function PreferencesForm({
  userId,
  initial,
}: {
  userId: string;
  initial: { email_enabled: boolean; digest_enabled: boolean };
}) {
  const [prefs, setPrefs] = useState(initial);
  const supabase = useMemo(() => createClient(), []);

  async function update(patch: Partial<typeof prefs>) {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    const { error } = await supabase.from("notification_preferences").update(patch).eq("user_id", userId);
    if (error) toast.error("Não salvou: " + error.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="email_enabled">Avisos por email</Label>
          <p className="text-sm text-muted-foreground">Menções, comentários e lembretes de prazo.</p>
        </div>
        <Switch
          id="email_enabled"
          checked={prefs.email_enabled}
          onCheckedChange={(checked) => update({ email_enabled: checked })}
        />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="digest_enabled">Resumo diário</Label>
          <p className="text-sm text-muted-foreground">Recebe o que está pendente/atrasado todo dia.</p>
        </div>
        <Switch
          id="digest_enabled"
          checked={prefs.digest_enabled}
          onCheckedChange={(checked) => update({ digest_enabled: checked })}
        />
      </div>
    </div>
  );
}
