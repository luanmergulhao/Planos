import { requireProfile } from "@/lib/auth/current-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseIntervalToHours, formatHours } from "@/lib/time/format";

function formatDay(iso: string) {
  return new Date(iso + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", weekday: "short" });
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

export default async function HorasPage() {
  const { supabase, user, profile } = await requireProfile();

  const { data: daily } = await supabase
    .from("daily_hours")
    .select("day, worked")
    .eq("user_id", user.id)
    .order("day", { ascending: false })
    .limit(14);

  const { data: monthly } = await supabase
    .from("monthly_hours")
    .select("month, worked")
    .eq("user_id", user.id)
    .order("month", { ascending: false })
    .limit(6);

  let team: { name: string; day: string; worked: number }[] = [];
  if (profile.role === "manager") {
    const { data: teamDaily } = await supabase
      .from("daily_hours")
      .select("user_id, day, worked, profiles(full_name, email)")
      .order("day", { ascending: false })
      .limit(200);

    team = (teamDaily ?? []).map((row) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { name: p?.full_name ?? p?.email ?? "?", day: row.day, worked: parseIntervalToHours(row.worked) };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Horas</h1>
        <p className="text-muted-foreground">Calculadas a partir do login/logout automático.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por dia (últimos 14)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(daily ?? []).map((row) => (
                  <TableRow key={row.day}>
                    <TableCell className="capitalize">{formatDay(row.day)}</TableCell>
                    <TableCell className="text-right">{formatHours(parseIntervalToHours(row.worked))}</TableCell>
                  </TableRow>
                ))}
                {(!daily || daily.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground">
                      Sem registros ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por mês</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(monthly ?? []).map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="capitalize">{formatMonth(row.month)}</TableCell>
                    <TableCell className="text-right">{formatHours(parseIntervalToHours(row.worked))}</TableCell>
                  </TableRow>
                ))}
                {(!monthly || monthly.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-sm text-muted-foreground">
                      Sem registros ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {profile.role === "manager" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Equipe (últimos dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pessoa</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="capitalize">{formatDay(row.day)}</TableCell>
                    <TableCell className="text-right">{formatHours(row.worked)}</TableCell>
                  </TableRow>
                ))}
                {team.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-sm text-muted-foreground">
                      Sem registros da equipe ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
