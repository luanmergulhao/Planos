"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommentThread } from "@/components/comments/CommentThread";
import { CommentComposer } from "@/components/comments/CommentComposer";
import type { CommentEntry } from "@/components/comments/types";
import type { TeamProfile } from "@/components/plano/types";

export function CommentSheet({
  planoId,
  itemId,
  teamProfiles,
  currentUserId,
  onClose,
}: {
  planoId: string;
  itemId: string;
  teamProfiles: TeamProfile[];
  currentUserId: string;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("comments")
        .select("id, body, mentioned_user_ids, created_at, profiles(id, full_name, email)")
        .eq("plano_item_id", itemId)
        .order("created_at", { ascending: true });

      if (!cancelled) {
        setComments(
          (data ?? []).map((row) => ({
            id: row.id,
            body: row.body,
            mentioned_user_ids: row.mentioned_user_ids,
            created_at: row.created_at,
            author: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as TeamProfile,
          }))
        );
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId, supabase]);

  async function handleSubmit(body: string, mentionedUserIds: string[]) {
    const { data, error } = await supabase
      .from("comments")
      .insert({
        plano_id: planoId,
        plano_item_id: itemId,
        author_id: currentUserId,
        body,
        mentioned_user_ids: mentionedUserIds,
      })
      .select("id, body, mentioned_user_ids, created_at, profiles(id, full_name, email)")
      .single();

    if (!error && data) {
      setComments((prev) => [
        ...prev,
        {
          id: data.id,
          body: data.body,
          mentioned_user_ids: data.mentioned_user_ids,
          created_at: data.created_at,
          author: (Array.isArray(data.profiles) ? data.profiles[0] : data.profiles) as TeamProfile,
        },
      ]);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-4 overflow-y-auto p-4">
        <SheetHeader className="p-0">
          <SheetTitle>Comentários</SheetTitle>
        </SheetHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : (
          <CommentThread comments={comments} teamProfiles={teamProfiles} />
        )}
        <CommentComposer teamProfiles={teamProfiles} onSubmit={handleSubmit} />
      </SheetContent>
    </Sheet>
  );
}
