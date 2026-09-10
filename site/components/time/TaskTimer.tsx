"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, Square, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatElapsedMs } from "@/lib/time/format";

type TaskEntry = {
  id: string;
  description: string;
  started_at: string;
  stopped_at: string | null;
};

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

export function TaskTimer({ userId }: { userId: string }) {
  const [running, setRunning] = useState<TaskEntry | null>(null);
  const [today, setToday] = useState<TaskEntry[]>([]);
  const [description, setDescription] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from("task_time_entries")
        .select("*")
        .eq("user_id", userId)
        .order("started_at", { ascending: false })
        .limit(50);

      if (cancelled || !data) return;

      const open = data.find((e) => !e.stopped_at) ?? null;
      setRunning(open);
      setToday(data.filter((e) => e.stopped_at && isToday(e.started_at)));
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [running]);

  async function handleStart() {
    if (!description.trim()) return;
    const { data, error } = await supabase
      .from("task_time_entries")
      .insert({ user_id: userId, description: description.trim() })
      .select("*")
      .single();
    if (!error && data) {
      setRunning(data);
      setDescription("");
      setNow(Date.now());
    }
  }

  async function handleStop() {
    if (!running) return;
    const stoppedAt = new Date().toISOString();
    const { error } = await supabase
      .from("task_time_entries")
      .update({ stopped_at: stoppedAt })
      .eq("id", running.id);
    if (!error) {
      setToday((prev) => [{ ...running, stopped_at: stoppedAt }, ...prev]);
      setRunning(null);
    }
  }

  async function handleDelete(id: string) {
    setToday((prev) => prev.filter((e) => e.id !== id));
    await supabase.from("task_time_entries").delete().eq("id", id);
  }

  const todayTotalMs = today.reduce(
    (sum, e) => sum + (new Date(e.stopped_at!).getTime() - new Date(e.started_at).getTime()),
    0
  );

  if (loading) return null;

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      {running ? (
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-medium">{running.description}</span>
          <span className="font-mono text-sm tabular-nums">
            {formatElapsedMs(now - new Date(running.started_at).getTime())}
          </span>
          <Button size="sm" variant="destructive" onClick={handleStop}>
            <Square className="size-3.5" />
            Parar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            placeholder="O que você está fazendo?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStart()}
            className="flex-1"
          />
          <Button size="sm" onClick={handleStart} disabled={!description.trim()}>
            <Play className="size-3.5" />
            Iniciar
          </Button>
        </div>
      )}

      {today.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Hoje</span>
            <span>{formatElapsedMs(todayTotalMs)}</span>
          </div>
          <ul className="flex flex-col gap-1">
            {today.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{entry.description}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {formatElapsedMs(new Date(entry.stopped_at!).getTime() - new Date(entry.started_at).getTime())}
                  </span>
                  <Button variant="ghost" size="icon-xs" onClick={() => handleDelete(entry.id)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
