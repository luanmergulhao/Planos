"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { CategorySection } from "@/components/plano/CategorySection";
import { ShareDialog } from "@/components/plano/ShareDialog";
import { CommentSheet } from "@/components/comments/CommentSheet";
import { AbaNotas } from "@/components/plano/AbaNotas";
import { BarraDeAbas } from "@/components/plano/BarraDeAbas";
import { DayBar } from "@/components/plano/DayBar";
import { CELULA, LINHA, ROTULO } from "@/components/plano/grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { shiftDay } from "@/lib/planos/day";
import { cn } from "@/lib/utils";
import type { CategoryRow, ItemRow, PlanoAbaRow, PlanoDayRow, PlanoRow, ShareEntry, TeamProfile } from "@/components/plano/types";
import type { DeadlinesComRevisao } from "@/lib/planos/deadlines";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// "2026-09-21" -> "21/09/2026", como aparece na linha ALINHAMENTO INICIAL
function formatDayNumeric(day: string) {
  return day.split("-").reverse().join("/");
}

export function PlanoEditor({
  plano,
  categories,
  items: initialItems,
  day,
  planoDay: initialPlanoDay,
  previousDayWithItems,
  deadlines,
  abas: abasIniciais,
  abaInicial,
  shares,
  teamProfiles,
  currentUserId,
  isOwner,
  canEdit,
  isManager,
  ownerLabel,
  updatedByLabel,
}: {
  plano: PlanoRow;
  categories: CategoryRow[];
  items: ItemRow[];
  day: string;
  planoDay: PlanoDayRow | null;
  previousDayWithItems: string | null;
  deadlines: DeadlinesComRevisao;
  abas: PlanoAbaRow[];
  abaInicial: string | null;
  shares: ShareEntry[];
  teamProfiles: TeamProfile[];
  currentUserId: string;
  isOwner: boolean;
  canEdit: boolean;
  isManager: boolean;
  ownerLabel: string;
  updatedByLabel: string | null;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [abas, setAbas] = useState(abasIniciais);
  const [abaAtiva, setAbaAtiva] = useState<string | null>(
    abaInicial && abasIniciais.some((a) => a.id === abaInicial) ? abaInicial : null
  );
  const [criandoAba, setCriandoAba] = useState(false);
  const [planoDay, setPlanoDay] = useState(initialPlanoDay);
  const [startingDay, setStartingDay] = useState(false);
  const [activeCommentItemId, setActiveCommentItemId] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const itemsByCategory = useMemo(() => {
    const map = new Map<string, ItemRow[]>();
    for (const item of items) {
      const list = map.get(item.category_id) ?? [];
      list.push(item);
      map.set(item.category_id, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.item_number - b.item_number);
    return map;
  }, [items]);

  function goToDay(newDay: string) {
    router.push(`/planos/${plano.id}?dia=${newDay}`);
  }

  // a aba aberta fica no endereço (?aba=...), sem recarregar a página
  function selecionarAba(id: string | null) {
    setAbaAtiva(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("aba", id);
    else url.searchParams.delete("aba");
    window.history.replaceState(null, "", url);
  }

  async function handleCriarAba() {
    setCriandoAba(true);
    const proximaOrdem = abas.reduce((maior, a) => Math.max(maior, a.sort_order), 0) + 1;
    const { data, error } = await supabase
      .from("plano_abas")
      .insert({
        plano_id: plano.id,
        titulo: "Nova aba",
        sort_order: proximaOrdem,
        created_by: currentUserId,
        updated_by: currentUserId,
      })
      .select("*")
      .single();
    setCriandoAba(false);

    if (error || !data) {
      toast.error("Não criou a aba: " + (error?.message ?? "erro desconhecido"));
      return;
    }
    setAbas((prev) => [...prev, data]);
    selecionarAba(data.id);
  }

  // depois do "Rodar prompt" da linha C, que insere linhas pelo servidor
  async function recarregarItens() {
    const { data } = await supabase.from("plano_items").select("*").eq("plano_id", plano.id).eq("day", day);
    if (data) setItems(data);
  }

  async function handleStartDay() {
    setStartingDay(true);

    if (previousDayWithItems) {
      const { data: previousItems } = await supabase
        .from("plano_items")
        .select("*")
        .eq("plano_id", plano.id)
        .eq("day", previousDayWithItems)
        .eq("riscado", false);

      if (previousItems && previousItems.length > 0) {
        const toInsert = previousItems.map((it) => ({
          plano_id: plano.id,
          category_id: it.category_id,
          item_number: it.item_number,
          content: it.content,
          deadline_at: it.deadline_at,
          status: it.status,
          day,
          riscado: false,
          created_by: currentUserId,
          updated_by: currentUserId,
        }));
        const { data: inserted } = await supabase.from("plano_items").insert(toInsert).select("*");
        if (inserted) setItems(inserted);
      }
    }

    const { data: dayRow } = await supabase
      .from("plano_days")
      .upsert(
        { plano_id: plano.id, day, alinhamento_inicial_at: new Date().toISOString(), started_by: currentUserId },
        { onConflict: "plano_id,day" }
      )
      .select("*")
      .single();
    if (dayRow) setPlanoDay(dayRow);
    setStartingDay(false);
  }

  async function handleEndDay() {
    const { data } = await supabase
      .from("plano_days")
      .upsert({ plano_id: plano.id, day, alinhamento_final_at: new Date().toISOString() }, { onConflict: "plano_id,day" })
      .select("*")
      .single();
    if (data) setPlanoDay(data);
  }

  // desfaz um "Finalizar o dia" clicado sem querer: a linha volta a ser
  // ALINHAMENTO INICIAL
  async function handleReopenDay() {
    const { data } = await supabase
      .from("plano_days")
      .update({ alinhamento_final_at: null })
      .eq("plano_id", plano.id)
      .eq("day", day)
      .select("*")
      .single();
    if (data) setPlanoDay(data);
  }

  async function ensureDayMarkedStarted() {
    if (planoDay) return;
    const { data } = await supabase
      .from("plano_days")
      .upsert(
        { plano_id: plano.id, day, alinhamento_inicial_at: new Date().toISOString(), started_by: currentUserId },
        { onConflict: "plano_id,day" }
      )
      .select("*")
      .single();
    if (data) setPlanoDay(data);
  }

  async function handleAddItem(categoryId: string) {
    await ensureDayMarkedStarted();
    const { data, error } = await supabase
      .from("plano_items")
      .insert({
        plano_id: plano.id,
        category_id: categoryId,
        day,
        created_by: currentUserId,
        updated_by: currentUserId,
      })
      .select("*")
      .single();
    if (!error && data) setItems((prev) => [...prev, data]);
  }

  async function handleUpdateItem(itemId: string, patch: Partial<ItemRow>) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)));
    await supabase
      .from("plano_items")
      .update({ ...patch, updated_by: currentUserId })
      .eq("id", itemId);
  }

  async function handleDeleteItem(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await supabase.from("plano_items").delete().eq("id", itemId);
  }

  async function handleToggleRiscado(itemId: string, riscado: boolean) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, riscado } : i)));
    await supabase.rpc("set_item_riscado", { item_id: itemId, new_riscado: riscado });
  }

  const iniciado = !!planoDay?.alinhamento_inicial_at;
  const finalizado = !!planoDay?.alinhamento_final_at;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{plano.title}</h1>
          <p className="text-sm text-muted-foreground">
            {isOwner ? "Seu Plano" : `Plano de ${ownerLabel}`}
            {updatedByLabel && ` · editado por ${updatedByLabel} ${timeAgo(plano.updated_at)}`}
            {!canEdit && (
              <>
                {" "}
                · <Badge variant="secondary">só visualização</Badge>
              </>
            )}
          </p>
        </div>
        {isOwner && (
          <ShareDialog planoId={plano.id} shares={shares} teamProfiles={teamProfiles} ownerId={plano.owner_id} />
        )}
      </div>

      <BarraDeAbas
        abas={abas}
        ativa={abaAtiva}
        canEdit={canEdit}
        criando={criandoAba}
        onSelecionar={selecionarAba}
        onCriar={handleCriarAba}
      />

      {abaAtiva !== null && abas.some((a) => a.id === abaAtiva) ? (
        <AbaNotas
          key={abaAtiva}
          aba={abas.find((a) => a.id === abaAtiva)!}
          canEdit={canEdit}
          currentUserId={currentUserId}
          teamProfiles={teamProfiles}
          onSalva={(linha) => setAbas((prev) => prev.map((a) => (a.id === linha.id ? linha : a)))}
          onExcluida={(id) => {
            setAbas((prev) => prev.filter((a) => a.id !== id));
            selecionarAba(null);
          }}
        />
      ) : (
        <>
          <DayBar
            day={day}
            onPrev={() => goToDay(shiftDay(day, -1))}
            onNext={() => goToDay(shiftDay(day, 1))}
            onPickDay={goToDay}
          />

          {/* Uma tabela só, como o documento do Google. A primeira linha é o
              alinhamento do dia e troca de nome: ALINHAMENTO INICIAL depois de
              iniciar, ALINHAMENTO FINAL depois de finalizar. */}
          <div className="overflow-hidden rounded-md border text-sm">
            <div className={LINHA}>
              <div className={cn(CELULA, iniciado ? ROTULO : "font-bold text-muted-foreground")}>
                {finalizado ? "ALINHAMENTO FINAL" : iniciado ? "ALINHAMENTO INICIAL" : "DIA NÃO INICIADO"}
              </div>
              <div className={CELULA}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-sm text-foreground">{formatDayNumeric(day)}</span>
                  {!iniciado && canEdit && (
                    <Button size="sm" onClick={handleStartDay} disabled={startingDay}>
                      {startingDay ? "Copiando..." : "Iniciar o dia"}
                    </Button>
                  )}
                  {iniciado && planoDay?.alinhamento_inicial_at && (
                    <span>iniciado às {formatTime(planoDay.alinhamento_inicial_at)}</span>
                  )}
                  {finalizado && planoDay?.alinhamento_final_at && (
                    <span>· finalizado às {formatTime(planoDay.alinhamento_final_at)}</span>
                  )}
                  {iniciado && !finalizado && canEdit && (
                    <Button variant="outline" size="sm" onClick={handleEndDay}>
                      Finalizar o dia
                    </Button>
                  )}
                  {finalizado && canEdit && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleReopenDay}>
                      Desfazer
                    </Button>
                  )}
                </div>
                {!iniciado && canEdit && previousDayWithItems && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ao iniciar, copia o Plano de {formatDayNumeric(previousDayWithItems)} sem o que foi riscado.
                  </p>
                )}
              </div>
            </div>

            {categories.map((category) => (
              <CategorySection
                key={category.id}
                category={category}
                items={itemsByCategory.get(category.id) ?? []}
                canEdit={canEdit}
                isManager={isManager}
                deadlines={category.code === "A" ? deadlines : null}
                planoId={plano.id}
                onRecarregarItens={recarregarItens}
                onAddItem={() => handleAddItem(category.id)}
                onUpdateItem={handleUpdateItem}
                onDeleteItem={handleDeleteItem}
                onToggleRiscado={handleToggleRiscado}
                onOpenComments={setActiveCommentItemId}
              />
            ))}
          </div>
        </>
      )}

      {activeCommentItemId && (
        <CommentSheet
          planoId={plano.id}
          itemId={activeCommentItemId}
          teamProfiles={teamProfiles}
          currentUserId={currentUserId}
          isManager={isManager}
          onClose={() => setActiveCommentItemId(null)}
        />
      )}
    </div>
  );
}
