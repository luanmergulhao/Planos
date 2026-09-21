"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { PlanoAbaRow, TeamProfile } from "@/components/plano/types";

type Status = "salvo" | "salvando" | "erro" | "conflito";

const nomeValido = (t: string) => t.trim() || "Sem nome";

function haQuanto(iso: string) {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "agora mesmo";
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas}h`;
  return `há ${Math.floor(horas / 24)}d`;
}

// Uma aba do Plano: bloco de notas com nome próprio. Salva sozinha (1,2s
// depois de parar de digitar e ao sair do campo). Se outra pessoa salvou
// antes, não sobrescreve: avisa e pede pra recarregar.
export function AbaNotas({
  aba,
  canEdit,
  currentUserId,
  teamProfiles,
  onSalva,
  onExcluida,
}: {
  aba: PlanoAbaRow;
  canEdit: boolean;
  currentUserId: string;
  teamProfiles: TeamProfile[];
  onSalva: (linha: PlanoAbaRow) => void;
  onExcluida: (id: string) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [titulo, setTitulo] = useState(aba.titulo);
  const [conteudo, setConteudo] = useState(aba.conteudo);
  const [status, setStatus] = useState<Status>("salvo");
  const [editadoPor, setEditadoPor] = useState(aba.updated_by);
  const [editadoEm, setEditadoEm] = useState(aba.updated_at);

  const [salvoNoBanco, setSalvoNoBanco] = useState({ titulo: aba.titulo, conteudo: aba.conteudo });
  const versao = useRef(aba.updated_at);
  const salvando = useRef(false);

  const sujo = nomeValido(titulo) !== salvoNoBanco.titulo || conteudo !== salvoNoBanco.conteudo;

  const salvar = useCallback(
    async (t: string, c: string) => {
      if (salvando.current) return; // quando terminar, o efeito confere se sobrou algo
      salvando.current = true;
      setStatus("salvando");

      const { data, error } = await supabase
        .from("plano_abas")
        .update({ titulo: nomeValido(t), conteudo: c, updated_by: currentUserId })
        .eq("id", aba.id)
        .eq("updated_at", versao.current) // só grava se ninguém salvou depois de mim
        .select("*");

      salvando.current = false;

      if (error) {
        setStatus("erro");
        toast.error("Não salvou a aba: " + error.message);
        return;
      }
      if (!data || data.length === 0) {
        setStatus("conflito");
        return;
      }

      const linha = data[0];
      versao.current = linha.updated_at;
      setSalvoNoBanco({ titulo: linha.titulo, conteudo: linha.conteudo });
      setEditadoPor(linha.updated_by);
      setEditadoEm(linha.updated_at);
      setStatus("salvo");
      onSalva(linha);
    },
    [supabase, aba.id, currentUserId, onSalva]
  );

  useEffect(() => {
    if (!canEdit || status === "conflito" || status === "salvando" || status === "erro") return;
    if (!sujo) return;
    const timer = setTimeout(() => void salvar(titulo, conteudo), 1200);
    return () => clearTimeout(timer);
  }, [titulo, conteudo, canEdit, status, sujo, salvar]);

  async function excluir() {
    if (!window.confirm(`Excluir a aba "${nomeValido(titulo)}"? O texto dela será apagado.`)) return;
    const { error } = await supabase.from("plano_abas").delete().eq("id", aba.id);
    if (error) {
      toast.error("Não excluiu a aba: " + error.message);
      return;
    }
    onExcluida(aba.id);
  }

  const autor = teamProfiles.find((p) => p.id === editadoPor);
  const textoDoStatus =
    status === "salvando"
      ? "Salvando..."
      : status === "erro"
        ? "Não salvou"
        : sujo
          ? "Alterações ainda não salvas"
          : `Salvo · editado por ${autor?.full_name ?? autor?.email ?? "?"} ${haQuanto(editadoEm)}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={titulo}
          disabled={!canEdit}
          placeholder="Nome da aba"
          className="max-w-sm font-semibold"
          onChange={(e) => {
            setTitulo(e.target.value);
            if (status === "erro") setStatus("salvo");
          }}
          onBlur={() => canEdit && sujo && status !== "conflito" && void salvar(titulo, conteudo)}
        />
        <span className="text-xs text-muted-foreground">{textoDoStatus}</span>
        {canEdit && (
          <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={excluir}>
            <Trash2 className="size-3.5" />
            Excluir aba
          </Button>
        )}
      </div>

      {status === "conflito" && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <span>
            Outra pessoa alterou esta aba enquanto você editava, então não salvei para não apagar o texto dela. Recarregue
            para ver a versão nova. O seu texto continua aqui até lá, se quiser copiá-lo.
          </span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            Recarregar
          </Button>
        </div>
      )}

      <Textarea
        value={conteudo}
        disabled={!canEdit}
        placeholder={canEdit ? "Escreva aqui. Por exemplo, cole um prompt para a CB avaliar." : "Nada escrito nesta aba ainda."}
        className="min-h-[60vh] resize-y text-sm leading-relaxed"
        onChange={(e) => {
          setConteudo(e.target.value);
          if (status === "erro") setStatus("salvo");
        }}
        onBlur={() => canEdit && sujo && status !== "conflito" && void salvar(titulo, conteudo)}
      />
    </div>
  );
}
