import Link from "next/link";
import { requireProfile } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

export default async function PlanosPage() {
  const { supabase, user } = await requireProfile();

  const { data: myPlano } = await supabase
    .from("planos")
    .select("id, title, updated_at")
    .eq("owner_id", user.id)
    .single();

  const { data: shared } = await supabase
    .from("plano_shares")
    // planos tem dois caminhos até profiles (owner_id e updated_by): o dono é o que interessa
    .select("permission, planos(id, title, updated_at, profiles!planos_owner_id_fkey(full_name, email))")
    .eq("user_id", user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Planos</h1>
        <p className="text-muted-foreground">O seu, e os que a equipe compartilhou com você.</p>
      </div>

      {myPlano && (
        <div>
          <h2 className="mb-2 text-sm font-medium text-muted-foreground">Meu Plano</h2>
          <Link href={`/planos/${myPlano.id}`}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{myPlano.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Atualizado {timeAgo(myPlano.updated_at)}
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Compartilhados comigo</h2>
        {!shared || shared.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ninguém compartilhou um Plano com você ainda.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {shared.map((share) => {
              const plano = Array.isArray(share.planos) ? share.planos[0] : share.planos;
              if (!plano) return null;
              const owner = Array.isArray(plano.profiles) ? plano.profiles[0] : plano.profiles;
              return (
                <Link key={plano.id} href={`/planos/${plano.id}`}>
                  <Card className="transition-colors hover:bg-muted/50">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <CardTitle className="text-base">{plano.title}</CardTitle>
                      <Badge variant={share.permission === "edit" ? "default" : "secondary"}>
                        {share.permission === "edit" ? "pode editar" : "só visualizar"}
                      </Badge>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      {owner?.full_name ?? owner?.email} · atualizado {timeAgo(plano.updated_at)}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
