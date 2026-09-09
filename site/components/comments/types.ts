import type { TeamProfile } from "@/components/plano/types";

export type CommentEntry = {
  id: string;
  body: string;
  mentioned_user_ids: string[];
  created_at: string;
  author: TeamProfile;
  parent_comment_id: string | null;
  resolved: boolean;
};
