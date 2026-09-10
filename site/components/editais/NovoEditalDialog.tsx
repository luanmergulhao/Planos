"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NovoEditalDialog({
  onCreate,
}: {
  onCreate: (input: { titulo: string; link: string | null; deadline_at: string | null }) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [link, setLink] = useState("");
  const [deadlineAt, setDeadlineAt] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    setSaving(true);
    await onCreate({ titulo: titulo.trim(), link: link.trim() || null, deadline_at: deadlineAt || null });
    setSaving(false);
    setTitulo("");
    setLink("");
    setDeadlineAt("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm">
            <Plus className="size-4" />
            Novo edital
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo edital</DialogTitle>
          <DialogDescription>Entra em &ldquo;Triagem&rdquo; — atualiza a fase depois conforme evolui.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edital-titulo">Título</Label>
            <Input id="edital-titulo" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edital-link">Link</Label>
            <Input id="edital-link" value={link} onChange={(e) => setLink(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edital-deadline">Prazo (se já souber)</Label>
            <Input
              id="edital-deadline"
              type="date"
              value={deadlineAt}
              onChange={(e) => setDeadlineAt(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={saving || !titulo.trim()}>
            Criar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
