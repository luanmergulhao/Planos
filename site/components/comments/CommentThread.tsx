"use client";

import { useState } from "react";
import { Check, CornerDownRight, Undo2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommentComposer } from "@/components/comments/CommentComposer";
import type { CommentEntry } from "@/components/comments/types";
import type { TeamProfile } from "@/components/plano/types";

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  return `há ${Math.floor(hours / 24)}d`;
}

function CommentBubble({
  comment,
  teamProfiles,
  isReply,
}: {
  comment: CommentEntry;
  teamProfiles: TeamProfile[];
  isReply: boolean;
}) {
  return (
    <div className={isReply ? "flex gap-2" : "flex gap-3"}>
      <Avatar className={isReply ? "size-6 shrink-0" : "size-8 shrink-0"}>
        <AvatarFallback>{initials(comment.author.full_name, comment.author.email)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{comment.author.full_name ?? comment.author.email}</span>
          <span className="text-xs text-muted-foreground">{timeAgo(comment.created_at)}</span>
        </div>
        <p className="text-sm">{comment.body}</p>
        {comment.mentioned_user_ids.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {comment.mentioned_user_ids.map((id) => {
              const profile = teamProfiles.find((p) => p.id === id);
              return (
                <Badge key={id} variant="secondary">
                  @{profile?.full_name ?? profile?.email ?? "?"}
                </Badge>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentThread({
  comments,
  teamProfiles,
  onReply,
  onToggleResolved,
}: {
  comments: CommentEntry[];
  teamProfiles: TeamProfile[];
  onReply: (parentCommentId: string, body: string, mentionedUserIds: string[]) => Promise<void> | void;
  onToggleResolved: (commentId: string, resolved: boolean) => void;
}) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  const topLevel = comments.filter((c) => !c.parent_comment_id);
  const repliesByParent = new Map<string, CommentEntry[]>();
  for (const c of comments) {
    if (!c.parent_comment_id) continue;
    const list = repliesByParent.get(c.parent_comment_id) ?? [];
    list.push(c);
    repliesByParent.set(c.parent_comment_id, list);
  }

  if (topLevel.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>;
  }

  return (
    <ul className="flex flex-col gap-5">
      {topLevel.map((comment) => {
        const replies = repliesByParent.get(comment.id) ?? [];
        return (
          <li key={comment.id} className={comment.resolved ? "opacity-60" : undefined}>
            <div className="flex items-start justify-between gap-2">
              <CommentBubble comment={comment} teamProfiles={teamProfiles} isReply={false} />
              <Button
                variant="ghost"
                size="icon-sm"
                title={comment.resolved ? "Reabrir" : "Marcar como resolvido"}
                onClick={() => onToggleResolved(comment.id, !comment.resolved)}
              >
                {comment.resolved ? <Undo2 className="size-4" /> : <Check className="size-4" />}
              </Button>
            </div>

            {replies.length > 0 && (
              <div className="ml-11 mt-2 flex flex-col gap-3 border-l pl-3">
                {replies.map((reply) => (
                  <CommentBubble key={reply.id} comment={reply} teamProfiles={teamProfiles} isReply />
                ))}
              </div>
            )}

            {replyingTo === comment.id ? (
              <div className="ml-11 mt-2">
                <CommentComposer
                  teamProfiles={teamProfiles}
                  compact
                  onSubmit={async (body, mentioned) => {
                    await onReply(comment.id, body, mentioned);
                    setReplyingTo(null);
                  }}
                />
              </div>
            ) : (
              <button
                type="button"
                className="ml-11 mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setReplyingTo(comment.id)}
              >
                <CornerDownRight className="size-3.5" />
                Responder
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
