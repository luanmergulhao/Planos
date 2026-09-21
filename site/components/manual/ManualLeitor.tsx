import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ManualItemIndice = {
  id: string;
  ordem: number;
  grupo: string | null;
  titulo: string;
  em_revisao: boolean;
};

// Índice à esquerda (agrupado pelas abas do Google) e a seção aberta à
// direita. O HTML já vem pronto e sem senhas de quem não pode vê-las.
export function ManualLeitor({
  indice,
  atual,
  html,
}: {
  indice: ManualItemIndice[];
  atual: ManualItemIndice;
  html: string;
}) {
  // o nome da aba só aparece na primeira seção de cada grupo
  const itens = indice.map((item, i) => ({ item, novoGrupo: i === 0 || item.grupo !== indice[i - 1].grupo }));

  return (
    <div className="grid gap-6 md:grid-cols-[260px_minmax(0,1fr)]">
      <nav className="md:sticky md:top-4 md:max-h-[calc(100vh-2rem)] md:self-start md:overflow-y-auto">
        <ul className="flex flex-col gap-0.5 text-sm">
          {itens.map(({ item, novoGrupo }) => (
            <li key={item.id}>
              {novoGrupo && item.grupo && (
                <p className="mt-3 px-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.grupo}</p>
              )}
              <Link
                href={`/manual?secao=${item.id}`}
                className={cn("block rounded-md px-2 py-1 hover:bg-muted", item.id === atual.id && "bg-muted font-medium")}
              >
                {item.titulo}
                {item.em_revisao && <span className="ml-1 text-xs text-amber-600">· em revisão</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <article className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{atual.titulo}</h1>
          {atual.em_revisao && <Badge variant="outline">em revisão pela CB</Badge>}
        </div>
        {atual.em_revisao && (
          <p className="mb-4 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
            Esta parte do manual está sendo reescrita. O texto abaixo é o original, sem as sugestões ainda não aprovadas.
          </p>
        )}
        <div className="manual-conteudo" dangerouslySetInnerHTML={{ __html: html }} />
      </article>
    </div>
  );
}
