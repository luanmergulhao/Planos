import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TriagemEntry, TriagensLinhaE } from "@/lib/planos/triagens";

function diaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

function Bloco({ titulo, entradas }: { titulo: string; entradas: TriagemEntry[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-sm font-semibold">{titulo}</h3>

      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma triagem nesse período.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entradas.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="shrink-0 tabular-nums">
                {diaCurto(e.deadline)}
              </Badge>
              <span>{e.titulo}</span>
              <span className="text-xs text-muted-foreground">triado em {diaCurto(e.triadoEm)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TriagemPanel({ triagens }: { triagens: TriagensLinhaE }) {
  return (
    <div className="flex flex-col gap-4 rounded-md border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ClipboardList className="size-3.5" />
        Triagens já feitas, com deadline chegando. As respostas completas ficam na{" "}
        <Link href="/editais" className="underline">
          aba Triagem
        </Link>
        .
      </div>

      <Bloco titulo="Deadline essa semana" entradas={triagens.semana} />
      <Bloco titulo="Deadline esse mês" entradas={triagens.mes} />
    </div>
  );
}
