import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

export function CommentThread({ comments, teamProfiles }: { comments: CommentEntry[]; teamProfiles: TeamProfile[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum comentário ainda.</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {comments.map((comment) => (
        <li key={comment.id} className="flex gap-3">
          <Avatar className="size-8 shrink-0">
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
        </li>
      ))}
    </ul>
  );
}
