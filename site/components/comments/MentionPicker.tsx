"use client";

import { AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TeamProfile } from "@/components/plano/types";

export function MentionPicker({
  teamProfiles,
  selectedIds,
  onChange,
}: {
  teamProfiles: TeamProfile[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  const selectedProfiles = teamProfiles.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="flex flex-wrap items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" type="button">
              <AtSign className="size-4" />
              Marcar pessoas
            </Button>
          }
        />
        <DropdownMenuContent>
          {teamProfiles.map((profile) => (
            <DropdownMenuCheckboxItem
              key={profile.id}
              checked={selectedIds.includes(profile.id)}
              onCheckedChange={() => toggle(profile.id)}
              onSelect={(e) => e.preventDefault()}
            >
              {profile.full_name ?? profile.email}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {selectedProfiles.map((profile) => (
        <Badge key={profile.id} variant="secondary">
          @{profile.full_name ?? profile.email}
        </Badge>
      ))}
    </div>
  );
}
