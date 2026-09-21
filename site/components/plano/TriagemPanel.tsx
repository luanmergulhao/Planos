import Link from "next/link";
import type { TriagemEntry, TriagensLinhaE } from "@/lib/planos/triagens";

function diaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

// No Plano do Google cada triagem é uma linha "T nome do edital dd/mm".
function Bloco({ titulo, entradas }: { titulo: string; entradas: TriagemEntry[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm">{titulo}</h3>

      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma triagem nesse período.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entradas.map((e) => (
            <li key={e.id} className="text-sm" title={`triado em ${diaCurto(e.triadoEm)}`}>
              T {e.titulo} {diaCurto(e.deadline)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TriagemPanel({ triagens }: { triagens: TriagensLinhaE }) {
  return (
    <div className="flex flex-col gap-3">
      <Bloco titulo="D NESTA SEMANA:" entradas={triagens.semana} />
      <Bloco titulo="D do MÊS:" entradas={triagens.mes} />

      <Link href="/editais" className="text-xs text-muted-foreground underline">
        Ver a planilha de triagem completa
      </Link>
    </div>
  );
}
