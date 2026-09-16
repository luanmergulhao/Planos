import { AlertTriangle, CalendarClock, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DeadlineEntry, DeadlinesComRevisao, RevisaoResumo } from "@/lib/planos/deadlines";

function diaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

// A fonte vem da IA — só vira link clicável se for http(s).
function safeHref(url: string | null) {
  const trimmed = url?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function Revisao({ revisao, titulo }: { revisao: RevisaoResumo; titulo: string }) {
  const fonte = safeHref(revisao.fonte_link);
  const revisadoEm = diaCurto(revisao.revisado_em.slice(0, 10));
  const jaEhDP = /^DP\s/i.test(titulo);

  if (revisao.status === "prorrogado" && revisao.novo_deadline) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400" variant="outline">
          Prorrogado até {diaCurto(revisao.novo_deadline)}
        </Badge>
        <span className="text-xs text-amber-700 dark:text-amber-400">
          {jaEhDP ? "atualizar a data na agenda" : "trocar D → DP e a data na agenda"}
        </span>
        {fonte && (
          <a href={fonte} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs underline">
            fonte <ExternalLink className="size-3" />
          </a>
        )}
      </span>
    );
  }

  if (revisao.status === "encerrado") {
    return (
      <Badge variant="destructive" title={revisao.evidencia ?? undefined}>
        Encerrado
      </Badge>
    );
  }

  if (revisao.status === "mantido") {
    return <span className="text-xs text-muted-foreground">prazo confirmado · revisado {revisadoEm}</span>;
  }

  return (
    <span className="text-xs text-muted-foreground" title={revisao.evidencia ?? undefined}>
      não confirmado · revisado {revisadoEm}
    </span>
  );
}

function Bloco({
  titulo,
  periodo,
  entradas,
  revisoes,
}: {
  titulo: string;
  periodo: string;
  entradas: DeadlineEntry[];
  revisoes: Record<string, RevisaoResumo>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <span className="text-xs text-muted-foreground">{periodo}</span>
      </div>

      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum deadline nesse período.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entradas.map((e) => {
            const revisao = revisoes[`${e.titulo}|${e.dia}`];
            return (
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
                {revisao && <Revisao revisao={revisao} titulo={e.titulo} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DeadlinesPanel({ deadlines }: { deadlines: DeadlinesComRevisao }) {
  const { semana, proximaSemana, inicioSemana, fimSemana, fimProximaSemana, revisoes } = deadlines;
  const temDivergencia = [...semana, ...proximaSemana].some((e) => e.divergencia);

  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarClock className="size-3.5" />
        Puxado da agenda do Google — só eventos que começam com D ou DP, conferidos todo dia contra prorrogação
      </div>

      <Bloco
        titulo="Deadlines desta semana"
        periodo={`${diaCurto(inicioSemana)} a ${diaCurto(fimSemana)}`}
        entradas={semana}
        revisoes={revisoes}
      />
      <Bloco
        titulo="Deadlines da próxima semana"
        periodo={`${diaCurto(fimSemana)} a ${diaCurto(fimProximaSemana)}`}
        entradas={proximaSemana}
        revisoes={revisoes}
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
