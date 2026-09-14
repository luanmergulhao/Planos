import { AlertTriangle, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeadlineEntry, DeadlinesLinhaA } from "@/lib/planos/deadlines";

function diaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function Bloco({ titulo, periodo, entradas }: { titulo: string; periodo: string; entradas: DeadlineEntry[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <span className="text-xs text-muted-foreground">{periodo}</span>
      </div>

      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum deadline nesse período.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entradas.map((e) => (
            <li key={e.titulo + e.dia} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="shrink-0 tabular-nums">
                {diaCurto(e.dia)}
              </Badge>
              <span>{e.titulo}</span>
              {e.divergencia && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="size-3" />
                  título diz {diaCurto(e.divergencia)}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function DeadlinesPanel({ deadlines }: { deadlines: DeadlinesLinhaA }) {
  const { semana, proximaSemana, inicioSemana, fimSemana, fimProximaSemana } = deadlines;
  const temDivergencia = [...semana, ...proximaSemana].some((e) => e.divergencia);

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" />
        Puxado da agenda do Google — só eventos que começam com D ou DP
      </div>

      <Bloco
        titulo="Deadlines desta semana"
        periodo={`${diaCurto(inicioSemana)} a ${diaCurto(fimSemana)}`}
        entradas={semana}
      />
      <Bloco
        titulo="Deadlines da próxima semana"
        periodo={`${diaCurto(fimSemana)} a ${diaCurto(fimProximaSemana)}`}
        entradas={proximaSemana}
      />

      {temDivergencia && (
        <p className="text-xs text-muted-foreground">
          A data escrita no título não bate com o fim do evento na agenda — normalmente é a barra
          arrastada pro lugar errado. Vale conferir antes de confiar no prazo.
        </p>
      )}
    </div>
  );
}
