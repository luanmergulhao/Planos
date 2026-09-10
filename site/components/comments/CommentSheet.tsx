"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CommentThread } from "@/components/comments/CommentThread";
import { CommentComposer } from "@/components/comments/CommentComposer";
import type { CommentEntry } from "@/components/comments/types";
import type { TeamProfile } from "@/components/plano/types";

const COMMENT_SELECT =
  "id, body, mentioned_user_ids, created_at, parent_comment_id, resolved, profiles(id, full_name, email)";

function toCommentEntry(row: {
  id: string;
  body: string;
  mentioned_user_ids: string[];
  created_at: string;
  parent_comment_id: string | null;
  resolved: boolean;
  profiles: TeamProfile | TeamProfile[];
}): CommentEntry {
  return {
    id: row.id,
    body: row.body,
    mentioned_user_ids: row.mentioned_user_ids,
    created_at: row.created_at,
    parent_comment_id: row.parent_comment_id,
    resolved: row.resolved,
    author: (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles) as TeamProfile,
  };
}

export function CommentSheet({
  planoId,
  itemId,
  teamProfiles,
  currentUserId,
  isManager,
  onClose,
}: {
  planoId: string;
  itemId: string;
  teamProfiles: TeamProfile[];
  currentUserId: string;
  isManager: boolean;
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
        .select(COMMENT_SELECT)
        .eq("plano_item_id", itemId)
        .order("created_at", { ascending: true });

      if (!cancelled) {
        setComments((data ?? []).map(toCommentEntry));
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [itemId, supabase]);

  async function insertComment(body: string, mentionedUserIds: string[], parentCommentId: string | null) {
    const { data, error } = await supabase
      .from("comments")
      .insert({
        plano_id: planoId,
        plano_item_id: itemId,
        author_id: currentUserId,
        body,
        mentioned_user_ids: mentionedUserIds,
        parent_comment_id: parentCommentId,
      })
      .select(COMMENT_SELECT)
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, toCommentEntry(data)]);
    }
  }

  async function handleReply(parentCommentId: string, body: string, mentionedUserIds: string[]) {
    await insertComment(body, mentionedUserIds, parentCommentId);
  }

  async function handleToggleResolved(commentId: string, resolved: boolean) {
    setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, resolved } : c)));
    // RPC em vez de update direto: só manager resolve (ver migration 0008).
    await supabase.rpc("toggle_comment_resolved", { comment_id: commentId, new_resolved: resolved });
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
          <CommentThread
            comments={comments}
            teamProfiles={teamProfiles}
            isManager={isManager}
            onReply={handleReply}
            onToggleResolved={handleToggleResolved}
          />
        )}
        <CommentComposer teamProfiles={teamProfiles} onSubmit={(body, mentioned) => insertComment(body, mentioned, null)} />
      </SheetContent>
    </Sheet>
  );
}
