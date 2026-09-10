import Link from "next/link";
import { requireProfile } from "@/lib/auth/current-user";
import { computeDigest, type DigestItem } from "@/lib/digest";
import { computeEditaisDigest } from "@/lib/editais";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function ItemList({ items, emptyText }: { items: DigestItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Badge variant="outline">{item.code}</Badge>
              <span>{item.texto}</span>
            </span>
            <span className="text-xs text-muted-foreground">{item.sourceLabel}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function DashboardPage() {
  const { supabase, user, profile } = await requireProfile();
  const [digest, editaisDigest] = await Promise.all([
    computeDigest(supabase, user.id),
    computeEditaisDigest(supabase),
  ]);

  const overdue = [...digest.overdue, ...editaisDigest.overdue];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {profile.full_name?.split(" ")[0] ?? profile.email}</h1>
        <p className="text-muted-foreground">Resumo do que precisa da sua atenção agora.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-destructive">Atrasado</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemList items={overdue} emptyText="Nada atrasado." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editais dessa semana</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemList items={editaisDigest.week} emptyText="Sem prazos nos próximos 7 dias." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Editais desse mês</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemList items={editaisDigest.month} emptyText="Sem prazos no resto do mês." />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prioridade</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemList items={digest.priority} emptyText="Sem urgências marcadas." />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
