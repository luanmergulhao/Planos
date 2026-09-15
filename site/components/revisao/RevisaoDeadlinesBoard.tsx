"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Database, RevisaoStatus } from "@/lib/supabase/types";

type RevisaoRow = Database["public"]["Tables"]["deadline_revisoes"]["Row"];

export type LinhaRevisao = {
  chave: string;
  titulo: string;
  deadlineAgenda: string;
  link: string | null;
  revisao: RevisaoRow | null;
};

const STATUS: Record<RevisaoStatus, { label: string; className: string }> = {
  mantido: { label: "Mantido", className: "border-emerald-500/50 text-emerald-700 dark:text-emerald-400" },
  prorrogado: {
    label: "Prorrogado",
    className: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  encerrado: { label: "Encerrado", className: "border-destructive/60 text-destructive" },
  nao_confirmado: { label: "Não confirmado", className: "text-muted-foreground" },
};

function dataBR(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function dataHoraBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// O link da fonte vem da IA e o do edital é digitado — só vira href se
// for http(s), pra nunca renderizar um "javascript:" clicável.
function safeHref(url: string | null) {
  const trimmed = url?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function LinkInput({
  chave,
  initial,
  currentUserId,
}: {
  chave: string;
  initial: string | null;
  currentUserId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [value, setValue] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");

  async function save() {
    const next = value.trim();
    if (next === saved) return;

    if (next === "") {
      const { error } = await supabase.from("deadline_links").delete().eq("chave_evento", chave);
      if (error) {
        toast.error("Não removeu o link: " + error.message);
        return;
      }
    } else {
      if (!safeHref(next)) {
        toast.error("O link precisa começar com http:// ou https://");
        return;
      }
      const { error } = await supabase.from("deadline_links").upsert({
        chave_evento: chave,
        link: next,
        updated_by: currentUserId,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        toast.error("Não salvou o link: " + error.message);
        return;
      }
    }

    setSaved(next);
    toast.success(next ? "Link salvo — entra na próxima revisão." : "Link removido.");
  }

  return (
    <Input
      value={value}
      placeholder="Colar link do edital"
      className="h-8 text-xs"
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
    />
  );
}

function TabelaRevisao({
  linhas,
  currentUserId,
  vazio,
}: {
  linhas: LinhaRevisao[];
  currentUserId: string;
  vazio: string;
}) {
  if (linhas.length === 0) {
    return <p className="text-sm text-muted-foreground">{vazio}</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Edital</TableHead>
          <TableHead>Deadline na agenda</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Novo deadline</TableHead>
          <TableHead>Evidência</TableHead>
          <TableHead>Data da revisão</TableHead>
          <TableHead>Link do edital</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {linhas.map((l) => {
          const r = l.revisao;
          const fonte = safeHref(r?.fonte_link ?? null);
          const jaEhDP = /^DP\s/i.test(l.titulo);

          return (
            <TableRow key={`${l.chave}|${l.deadlineAgenda}`}>
              <TableCell className="min-w-56 whitespace-normal font-medium">{l.titulo}</TableCell>
              <TableCell className="tabular-nums">{dataBR(l.deadlineAgenda)}</TableCell>
              <TableCell>
                {r ? (
                  <Badge variant="outline" className={STATUS[r.status].className}>
                    {STATUS[r.status].label}
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Ainda não revisado</span>
                )}
              </TableCell>
              <TableCell className="whitespace-normal">
                {r?.status === "prorrogado" && r.novo_deadline ? (
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium tabular-nums">{dataBR(r.novo_deadline)}</span>
                    {r.novo_deadline_texto && (
                      <span className="text-xs text-muted-foreground">{r.novo_deadline_texto}</span>
                    )}
                    <span className="text-xs text-amber-700 dark:text-amber-400">
                      {jaEhDP ? "Atualizar a data na agenda" : "Trocar D → DP e a data na agenda"}
                    </span>
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="min-w-64 max-w-md whitespace-normal text-xs">
                {r?.evidencia ?? "—"}
                {fonte && (
                  <a
                    href={fonte}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 inline-flex items-center gap-0.5 underline"
                  >
                    fonte <ExternalLink className="size-3" />
                  </a>
                )}
              </TableCell>
              <TableCell className="text-xs tabular-nums">{r ? dataHoraBR(r.revisado_em) : "—"}</TableCell>
              <TableCell className="min-w-56">
                <LinkInput chave={l.chave} initial={l.link} currentUserId={currentUserId} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function RevisaoDeadlinesBoard({
  naJanela,
  anteriores,
  currentUserId,
}: {
  naJanela: LinhaRevisao[];
  anteriores: LinhaRevisao[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [revisando, setRevisando] = useState(false);

  async function revisarAgora() {
    setRevisando(true);
    try {
      const res = await fetch("/api/deadlines/revisar", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error("A revisão falhou: " + (data.error ?? res.status));
        return;
      }
      toast.success(
        `${data.revisados} edital(is) revisado(s)` +
          (data.prorrogados ? ` — ${data.prorrogados} prorrogado(s)!` : ".")
      );
      router.refresh();
    } finally {
      setRevisando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Revisão de Deadlines</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Todo dia a IA confere se os deadlines D/DP desta semana e da próxima foram prorrogados, mantidos
            ou encerrados, e registra a data da revisão. Sem o link do edital cadastrado, ela não consegue
            abrir a página oficial pra conferir.
          </p>
        </div>
        <Button onClick={revisarAgora} disabled={revisando}>
          <RefreshCw className={revisando ? "size-4 animate-spin" : "size-4"} />
          {revisando ? "Revisando..." : "Revisar agora"}
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Deadlines desta semana e da próxima</h2>
        <TabelaRevisao
          linhas={naJanela}
          currentUserId={currentUserId}
          vazio="Nenhum deadline D/DP nesse período na agenda."
        />
      </section>

      {anteriores.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">Revisados anteriormente</h2>
          <TabelaRevisao linhas={anteriores} currentUserId={currentUserId} vazio="" />
        </section>
      )}
    </div>
  );
}
