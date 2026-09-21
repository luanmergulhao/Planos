"use client";

import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDayLabel, todaySaoPaulo } from "@/lib/planos/day";

// Só navegação entre dias. Os horários de início e fim do dia ficam nas
// linhas ALINHAMENTO INICIAL / FINAL da própria tabela do Plano.
export function DayBar({
  day,
  onPrev,
  onNext,
  onPickDay,
}: {
  day: string;
  onPrev: () => void;
  onNext: () => void;
  onPickDay: (day: string) => void;
}) {
  const isToday = day === todaySaoPaulo();

  return (
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
  );
}
