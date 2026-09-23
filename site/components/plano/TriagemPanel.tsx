import Link from "next/link";
import type { TriagemEntry, TriagensLinhaE } from "@/lib/planos/triagens";
import { AdicionarTriagemForm } from "@/components/plano/AdicionarTriagemForm";

function diaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

// O título do evento já costuma trazer a data ("... 2026 30/09"); só
// acrescenta o dia quando não traz, pra linha sempre dizer a data.
const TEM_DATA = /\d{1,2}\/\d{1,2}/;

// No Plano do Google cada triagem é uma linha "T nome do edital dd/mm",
// que é o próprio título do evento da agenda.
function Bloco({ titulo, entradas }: { titulo: string; entradas: TriagemEntry[] }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm">{titulo}</h3>

      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma triagem nesse período.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {entradas.map((e) => (
            <li key={e.titulo + e.dia} className="text-sm">
              {e.titulo}
              {TEM_DATA.test(e.titulo) ? "" : ` ${diaCurto(e.dia)}`}
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

      <AdicionarTriagemForm />

      <Link href="/editais" className="text-xs text-muted-foreground underline">
        Ver a planilha de triagem completa
      </Link>
    </div>
  );
}
