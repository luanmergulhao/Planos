"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CategorySection } from "@/components/plano/CategorySection";
import { ShareDialog } from "@/components/plano/ShareDialog";
import { CommentSheet } from "@/components/comments/CommentSheet";
import { Badge } from "@/components/ui/badge";
import type { CategoryRow, ItemRow, PlanoRow, ShareEntry, TeamProfile } from "@/components/plano/types";

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
  shares,
  teamProfiles,
  currentUserId,
  isOwner,
  canEdit,
  ownerLabel,
  updatedByLabel,
}: {
  plano: PlanoRow;
  categories: CategoryRow[];
  items: ItemRow[];
  shares: ShareEntry[];
  teamProfiles: TeamProfile[];
  currentUserId: string;
  isOwner: boolean;
  canEdit: boolean;
  ownerLabel: string;
  updatedByLabel: string | null;
}) {
  const [items, setItems] = useState(initialItems);
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

  async function handleAddItem(categoryId: string) {
    const { data, error } = await supabase
      .from("plano_items")
      .insert({ plano_id: plano.id, category_id: categoryId, created_by: currentUserId, updated_by: currentUserId })
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

      <div className="flex flex-col gap-4">
        {categories.map((category) => (
          <CategorySection
            key={category.id}
            category={category}
            items={itemsByCategory.get(category.id) ?? []}
            canEdit={canEdit}
            onAddItem={() => handleAddItem(category.id)}
            onUpdateItem={handleUpdateItem}
            onDeleteItem={handleDeleteItem}
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
          onClose={() => setActiveCommentItemId(null)}
        />
      )}
    </div>
  );
}
