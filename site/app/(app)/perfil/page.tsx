import { requireProfile } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PreferencesForm } from "@/components/profile/PreferencesForm";
import { PasswordForm } from "@/components/profile/PasswordForm";

export default async function PerfilPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_enabled, digest_enabled")
    .eq("user_id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Perfil</h1>
        <p className="text-muted-foreground">{profile.full_name ?? profile.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notificações</CardTitle>
        </CardHeader>
        <CardContent>
          <PreferencesForm userId={user.id} initial={prefs ?? { email_enabled: true, digest_enabled: true }} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
