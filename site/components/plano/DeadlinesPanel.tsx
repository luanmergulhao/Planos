"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { chaveEvento } from "@/lib/planos/chave-evento";
import type { DeadlineEntry, DeadlinesComRevisao, RevisaoResumo } from "@/lib/planos/deadlines";

function diaCurto(dia: string) {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

// A fonte vem da IA e o link é digitado — só vira clicável se for http(s).
function safeHref(url: string | null) {
  const trimmed = url?.trim();
  return trimmed && /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

function ResultadoRevisao({ revisao, titulo }: { revisao: RevisaoResumo; titulo: string }) {
  const fonte = safeHref(revisao.fonte_link);
  const revisadoEm = diaCurto(revisao.revisado_em.slice(0, 10));
  const jaEhDP = /^DP\s/i.test(titulo);

  if (revisao.status === "prorrogado" && revisao.novo_deadline) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400">
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
    return (
      <span className="text-xs text-muted-foreground" title={revisao.evidencia ?? undefined}>
        prazo confirmado · revisado {revisadoEm}
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground" title={revisao.evidencia ?? undefined}>
      não confirmado · revisado {revisadoEm}
    </span>
  );
}

function Cabecalho({ entrada, revisao }: { entrada: DeadlineEntry; revisao: RevisaoResumo | undefined }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge variant="outline" className="shrink-0 tabular-nums">
        {diaCurto(entrada.dia)}
      </Badge>
      <span>{entrada.titulo}</span>
      {entrada.divergencia && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="size-3" />
          título diz {diaCurto(entrada.divergencia)}
        </Badge>
      )}
      {revisao && <ResultadoRevisao revisao={revisao} titulo={entrada.titulo} />}
    </div>
  );
}

// Deadline desta semana: é o único que a equipe acompanha contra
// prorrogação, então só ele ganha campo de link e botão de conferir.
function LinhaComConferencia({
  entrada,
  linkInicial,
  revisaoInicial,
}: {
  entrada: DeadlineEntry;
  linkInicial: string;
  revisaoInicial: RevisaoResumo | undefined;
}) {
  const supabase = useMemo(() => createClient(), []);
  const chave = useMemo(() => chaveEvento(entrada.titulo), [entrada.titulo]);

  const [link, setLink] = useState(linkInicial);
  const [linkSalvo, setLinkSalvo] = useState(linkInicial);
  const [revisao, setRevisao] = useState(revisaoInicial);
  const [conferindo, setConferindo] = useState(false);

  async function salvarLink() {
    const novo = link.trim();
    if (novo === linkSalvo) return;

    if (novo === "") {
      const { error } = await supabase.from("deadline_links").delete().eq("chave_evento", chave);
      if (error) {
        toast.error("Não removeu o link: " + error.message);
        return;
      }
    } else {
      if (!safeHref(novo)) {
        toast.error("O link precisa começar com http:// ou https://");
        return;
      }
      const { error } = await supabase
        .from("deadline_links")
        .upsert({ chave_evento: chave, link: novo, updated_at: new Date().toISOString() });
      if (error) {
        toast.error("Não salvou o link: " + error.message);
        return;
      }
    }

    setLinkSalvo(novo);
    toast.success(novo ? "Link salvo." : "Link removido.");
  }

  async function conferir() {
    setConferindo(true);
    try {
      const res = await fetch("/api/deadlines/revisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo: entrada.titulo, dia: entrada.dia }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast.error("Não deu pra conferir: " + (data.error ?? res.status));
        return;
      }

      setRevisao(data.revisao);
      toast.success(
        data.revisao.status === "prorrogado"
          ? "Prorrogado! Veja a nova data."
          : data.revisao.status === "encerrado"
            ? "Esse edital consta como encerrado."
            : data.revisao.status === "mantido"
              ? "Prazo confirmado, sem prorrogação."
              : "Não deu pra confirmar — tente de novo mais tarde."
      );
    } finally {
      setConferindo(false);
    }
  }

  const semLink = linkSalvo.trim() === "";

  return (
    <li className="flex flex-col gap-1.5 rounded-md border bg-background p-2">
      <Cabecalho entrada={entrada} revisao={revisao} />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={link}
          placeholder="Link do edital (obrigatório pra conferir)"
          className="h-8 max-w-md flex-1 text-xs"
          aria-invalid={semLink}
          onChange={(e) => setLink(e.target.value)}
          onBlur={salvarLink}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={semLink || conferindo}
          title={semLink ? "Cole o link do edital primeiro" : "Conferir se o prazo foi prorrogado"}
          onClick={conferir}
        >
          <Search className={conferindo ? "size-4 animate-pulse" : "size-4"} />
          {conferindo ? "Conferindo..." : "Conferir prorrogação"}
        </Button>
      </div>
    </li>
  );
}

function Bloco({
  titulo,
  periodo,
  entradas,
  revisoes,
  links,
  comConferencia,
}: {
  titulo: string;
  periodo: string;
  entradas: DeadlineEntry[];
  revisoes: Record<string, RevisaoResumo>;
  links: Record<string, string>;
  comConferencia: boolean;
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
        <ul className={comConferencia ? "flex flex-col gap-2" : "flex flex-col gap-1"}>
          {entradas.map((e) =>
            comConferencia ? (
              <LinhaComConferencia
                key={e.titulo + e.dia}
                entrada={e}
                linkInicial={links[chaveEvento(e.titulo)] ?? ""}
                revisaoInicial={revisoes[`${e.titulo}|${e.dia}`]}
              />
            ) : (
              <li key={e.titulo + e.dia}>
                <Cabecalho entrada={e} revisao={revisoes[`${e.titulo}|${e.dia}`]} />
              </li>
            )
          )}
        </ul>
      )}
    </div>
  );
}

export function DeadlinesPanel({ deadlines }: { deadlines: DeadlinesComRevisao }) {
  const { semana, proximaSemana, inicioSemana, fimSemana, fimProximaSemana, revisoes, links } = deadlines;
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
        revisoes={revisoes}
        links={links}
        comConferencia
      />
      <Bloco
        titulo="Deadlines da próxima semana"
        periodo={`${diaCurto(fimSemana)} a ${diaCurto(fimProximaSemana)}`}
        entradas={proximaSemana}
        revisoes={revisoes}
        links={links}
        comConferencia={false}
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
