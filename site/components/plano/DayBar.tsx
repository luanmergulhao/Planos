"use client";

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLabel, todaySaoPaulo } from "@/lib/planos/day";
import type { PlanoDayRow } from "@/components/plano/types";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function DayBar({
  day,
  planoDay,
  canEdit,
  onPrev,
  onNext,
  onPickDay,
  onEndDay,
}: {
  day: string;
  planoDay: PlanoDayRow | null;
  canEdit: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPickDay: (day: string) => void;
  onEndDay: () => void;
}) {
  const isToday = day === todaySaoPaulo();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={onPrev}>
          <ChevronLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium capitalize">{formatDayLabel(day)}</span>
          {isToday && <Badge variant="secondary">hoje</Badge>}
        </div>
        <Button variant="outline" size="icon" onClick={onNext} disabled={isToday}>
          <ChevronRight className="size-4" />
        </Button>
        <input
          type="date"
          value={day}
          max={todaySaoPaulo()}
          onChange={(e) => e.target.value && onPickDay(e.target.value)}
          className="h-9 rounded-md border bg-transparent px-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {planoDay?.alinhamento_inicial_at && <span>Início: {formatTime(planoDay.alinhamento_inicial_at)}</span>}
        {planoDay?.alinhamento_final_at ? (
          <span>Fim: {formatTime(planoDay.alinhamento_final_at)}</span>
        ) : (
          canEdit &&
          planoDay?.alinhamento_inicial_at && (
            <Button variant="outline" size="sm" onClick={onEndDay}>
              Alinhamento final
            </Button>
          )
        )}
      </div>
    </div>
  );
}
