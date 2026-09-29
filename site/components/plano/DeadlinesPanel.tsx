"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, Search } from "lucide-react";
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

function Situacao({ revisao, titulo }: { revisao: RevisaoResumo; titulo: string }) {
  const fonte = safeHref(revisao.fonte_link);
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

  return (
    <span className="text-xs text-muted-foreground" title={revisao.evidencia ?? undefined}>
      {revisao.status === "mantido" ? "Não prorrogado" : "Não confirmado"}
    </span>
  );
}

// Situação da última conferência + todos os dias em que foi feita, como a
// instrução da linha A pede ("Revisão: xx/xx, xx/xx").
function ResultadoRevisao({ revisao, titulo }: { revisao: RevisaoResumo | undefined; titulo: string }) {
  if (!revisao) {
    return <span className="text-xs text-muted-foreground">Sem revisão</span>;
  }
  return (
    <>
      <Situacao revisao={revisao} titulo={titulo} />
      <span className="text-xs text-muted-foreground">Revisão: {revisao.datas.map(diaCurto).join(", ")}</span>
    </>
  );
}

// O título do evento já costuma trazer a data ("... 2026 30/09"); só
// acrescenta o dia quando não traz, pra linha sempre dizer a data.
const TEM_DATA = /\d{1,2}\/\d{1,2}/;
const DATA_NO_TITULO = /\d{1,2}\/\d{1,2}(?:\/\d{2,4})?/;

// Prorrogou: a data antiga fica riscada e a nova vem ao lado — no Plano
// do Google a data anterior nunca é apagada, só tachada.
function TituloDoDeadline({ entrada, novoDeadline }: { entrada: DeadlineEntry; novoDeadline: string | null }) {
  if (!novoDeadline) {
    return (
      <span>
        {entrada.titulo}
        {TEM_DATA.test(entrada.titulo) ? "" : ` ${diaCurto(entrada.dia)}`}
      </span>
    );
  }

  const nova = <strong className="text-amber-700 dark:text-amber-400">{diaCurto(novoDeadline)}</strong>;
  const m = DATA_NO_TITULO.exec(entrada.titulo);
  if (!m) {
    return (
      <span>
        {entrada.titulo} <s>{diaCurto(entrada.dia)}</s> {nova}
      </span>
    );
  }
  return (
    <span>
      {entrada.titulo.slice(0, m.index)}
      <s>{m[0]}</s> {nova}
      {entrada.titulo.slice(m.index + m[0].length)}
    </span>
  );
}

function Cabecalho({
  entrada,
  revisao,
  extra,
}: {
  entrada: DeadlineEntry;
  revisao: RevisaoResumo | undefined;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
      <TituloDoDeadline
        entrada={entrada}
        novoDeadline={revisao?.status === "prorrogado" ? revisao.novo_deadline : null}
      />
      {entrada.divergencia && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="size-3" />
          título diz {diaCurto(entrada.divergencia)}
        </Badge>
      )}
      <ResultadoRevisao revisao={revisao} titulo={entrada.titulo} />
      {extra}
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
  const [aberto, setAberto] = useState(false);

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

      // soma o dia de hoje às revisões que já apareciam na linha
      setRevisao((antes) => ({
        ...data.revisao,
        datas: [...new Set([...(antes?.datas ?? []), ...data.revisao.datas])].sort(),
      }));

      const resumo =
        data.revisao.status === "prorrogado"
          ? "Prorrogado! Veja a nova data."
          : data.revisao.status === "encerrado"
            ? "Esse edital consta como encerrado."
            : data.revisao.status === "mantido"
              ? "Prazo confirmado, sem prorrogação."
              : "Não deu pra confirmar — tente de novo mais tarde.";

      // o modo grátis responde bem pior; quem lê precisa saber disso
      toast.success(resumo, {
        description: data.ia && !data.ia.pro ? "Respondido no modo grátis — qualidade menor." : undefined,
      });
    } finally {
      setConferindo(false);
    }
  }

  const semLink = linkSalvo.trim() === "";

  return (
    <li className="flex flex-col gap-1">
      <Cabecalho
        entrada={entrada}
        revisao={revisao}
        extra={
          <Button
            size="icon"
            variant="ghost"
            className="size-6 text-muted-foreground"
            title="Conferir se o prazo foi prorrogado"
            onClick={() => setAberto((v) => !v)}
          >
            <Search className={conferindo ? "size-3.5 animate-pulse" : "size-3.5"} />
          </Button>
        }
      />

      {aberto && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={link}
            placeholder="Link do edital (obrigatório pra conferir)"
            className="h-7 max-w-md flex-1 text-xs"
            aria-invalid={semLink}
            onChange={(e) => setLink(e.target.value)}
            onBlur={salvarLink}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={semLink || conferindo}
            title={semLink ? "Cole o link do edital primeiro" : "Conferir se o prazo foi prorrogado"}
            onClick={conferir}
          >
            {conferindo ? "Conferindo..." : "Conferir prorrogação"}
          </Button>
        </div>
      )}
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
    <div className="flex flex-col gap-1">
      <h3 className="text-sm" title={periodo}>
        {titulo}
      </h3>

      {entradas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum deadline nesse período.</p>
      ) : (
        <ul className="flex flex-col gap-1">
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
    <div className="flex flex-col gap-3">
      <Bloco
        titulo="DEADLINES DESTA SEMANA"
        periodo={`${diaCurto(inicioSemana)} a ${diaCurto(fimSemana)}`}
        entradas={semana}
        revisoes={revisoes}
        links={links}
        comConferencia
      />
      <Bloco
        titulo="DEADLINES DA PROXIMA SEMANA"
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
