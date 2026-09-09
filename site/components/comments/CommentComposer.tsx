"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { MentionPicker } from "@/components/comments/MentionPicker";
import type { TeamProfile } from "@/components/plano/types";

export function CommentComposer({
  teamProfiles,
  onSubmit,
  compact = false,
}: {
  teamProfiles: TeamProfile[];
  onSubmit: (body: string, mentionedUserIds: string[]) => Promise<void> | void;
  compact?: boolean;
}) {
  const [body, setBody] = useState("");
  const [mentioned, setMentioned] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  async function handleSubmit() {
    if (!body.trim()) return;
    setSending(true);
    await onSubmit(body.trim(), mentioned);
    setBody("");
    setMentioned([]);
    setSending(false);
  }

  return (
    <div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-2 border-t pt-3"}>
      <Textarea
        placeholder={compact ? "Responder..." : "Deixe um comentário..."}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus={compact}
        className={compact ? "min-h-10" : "min-h-16"}
      />
      <div className="flex items-center justify-between gap-2">
        <MentionPicker teamProfiles={teamProfiles} selectedIds={mentioned} onChange={setMentioned} />
        <Button size="sm" onClick={handleSubmit} disabled={sending || !body.trim()}>
          {compact ? "Responder" : "Comentar"}
        </Button>
      </div>
    </div>
  );
}
