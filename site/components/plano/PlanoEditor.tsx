"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CategorySection } from "@/components/plano/CategorySection";
import { ShareDialog } from "@/components/plano/ShareDialog";
import { CommentSheet } from "@/components/comments/CommentSheet";
import { DayBar } from "@/components/plano/DayBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDayLabel, shiftDay } from "@/lib/planos/day";
import type { CategoryRow, ItemRow, PlanoDayRow, PlanoRow, ShareEntry, TeamProfile } from "@/components/plano/types";
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

export function PlanoEditor({
  plano,
  categories,
  items: initialItems,
  day,
  planoDay: initialPlanoDay,
  previousDayWithItems,
  deadlines,
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

      <DayBar
        day={day}
        planoDay={planoDay}
        canEdit={canEdit}
        onPrev={() => goToDay(shiftDay(day, -1))}
        onNext={() => goToDay(shiftDay(day, 1))}
        onPickDay={goToDay}
        onEndDay={handleEndDay}
      />

      {items.length === 0 && !planoDay && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-muted-foreground">
              {previousDayWithItems
                ? `Esse dia ainda não foi iniciado. Copiar o Plano de ${formatDayLabel(previousDayWithItems)}?`
                : "Esse dia ainda não foi iniciado."}
            </p>
            {canEdit && (
              <Button size="sm" onClick={handleStartDay} disabled={startingDay}>
                {startingDay ? "Copiando..." : previousDayWithItems ? "Começar o dia (copiar)" : "Começar o dia"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            items={itemsByCategory.get(category.id) ?? []}
            canEdit={canEdit}
            isManager={isManager}
            deadlines={category.code === "A" ? deadlines : null}
            onAddItem={() => handleAddItem(category.id)}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
            onToggleRiscado={handleToggleRiscado}
            onOpenComments={setActiveCommentItemId}
          />
        ))}
      </div>

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
