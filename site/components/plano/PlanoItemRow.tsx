"use client";

import { useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { itemCode } from "@/lib/planos/categories";
import type { ItemRow, ItemStatus } from "@/components/plano/types";
import type { PlanoItemContent } from "@/lib/supabase/types";

const STATUS_LABEL: Record<ItemStatus, string> = {
  pendente: "Pendente",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  urgente: "Urgente",
};

export function PlanoItemRow({
  item,
  categoryCode,
  canEdit,
  onUpdate,
  onDelete,
  onOpenComments,
}: {
  item: ItemRow;
  categoryCode: string;
  canEdit: boolean;
  onUpdate: (patch: Partial<ItemRow>) => void;
  onDelete: () => void;
  onOpenComments: () => void;
}) {
  const content = item.content as PlanoItemContent;
  const [texto, setTexto] = useState(content.texto ?? "");
  const [link, setLink] = useState(content.link ?? "");
  const [responsavel, setResponsavel] = useState(content.responsavel ?? "");

  function commitContent(patch: Partial<PlanoItemContent>) {
    const nextContent = { ...content, ...patch };
    onUpdate({ content: nextContent });
  }

  function commitDeadline(value: string) {
    onUpdate({ deadline_at: value || null, content: { ...content, data_prazo: value || null } });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-start gap-3">
        <Badge variant="outline" className="mt-1 shrink-0">
          {itemCode(categoryCode, item.item_number)}
        </Badge>
        <Textarea
          value={texto}
          disabled={!canEdit}
          placeholder="O que precisa ser feito..."
          className="min-h-9 flex-1 resize-none"
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => commitContent({ texto })}
        />
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" onClick={onOpenComments}>
            <MessageSquare className="size-4" />
          </Button>
          {canEdit && (
            <Button variant="ghost" size="icon" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pl-11 text-sm">
        <Input
          type="date"
          value={item.deadline_at ?? ""}
          disabled={!canEdit}
          className="w-40"
          onChange={(e) => commitDeadline(e.target.value)}
        />
        <Input
          placeholder="Link"
          value={link}
          disabled={!canEdit}
          className="w-40"
          onChange={(e) => setLink(e.target.value)}
          onBlur={() => commitContent({ link })}
        />
        <Input
          placeholder="Responsável"
          value={responsavel}
          disabled={!canEdit}
          className="w-40"
          onChange={(e) => setResponsavel(e.target.value)}
          onBlur={() => commitContent({ responsavel })}
        />
        <Select
          value={item.status}
          disabled={!canEdit}
          onValueChange={(value) => onUpdate({ status: value as ItemStatus })}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
