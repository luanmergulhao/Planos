"use client";

import { useMemo, useState } from "react";
import { Share2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { ShareEntry, SharePermission, TeamProfile } from "@/components/plano/types";

export function ShareDialog({
  planoId,
  shares: initialShares,
  teamProfiles,
  ownerId,
}: {
  planoId: string;
  shares: ShareEntry[];
  teamProfiles: TeamProfile[];
  ownerId: string;
}) {
  const [shares, setShares] = useState(initialShares);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [permission, setPermission] = useState<SharePermission>("view");
  const [loading, setLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const sharedUserIds = new Set([...shares.map((s) => s.profile.id), ownerId]);
  const candidates = teamProfiles.filter((p) => !sharedUserIds.has(p.id));

  async function handleAdd() {
    if (!selectedUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("plano_shares")
      .insert({ plano_id: planoId, user_id: selectedUserId, permission })
      // plano_shares liga com profiles por dois caminhos (user_id e granted_by):
      // sem dizer qual, o banco recusa a consulta
      .select("id, permission, profiles!plano_shares_user_id_fkey(id, full_name, email)")
      .single();
    setLoading(false);

    if (error) {
      toast.error("Não deu pra compartilhar: " + error.message);
      return;
    }

    const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;
    setShares((prev) => [...prev, { id: data.id, permission: data.permission, profile: profile! }]);
    setSelectedUserId("");
    toast.success("Acesso concedido.");
  }

  async function handleRevoke(shareId: string) {
    setShares((prev) => prev.filter((s) => s.id !== shareId));
    await supabase.from("plano_shares").delete().eq("id", shareId);
  }

  async function handlePermissionChange(shareId: string, next: SharePermission) {
    setShares((prev) => prev.map((s) => (s.id === shareId ? { ...s, permission: next } : s)));
    await supabase.from("plano_shares").update({ permission: next }).eq("id", shareId);
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Share2 className="size-4" />
            Compartilhar
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar Plano</DialogTitle>
          <DialogDescription>Escolha quem da equipe pode ver ou editar.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {shares.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não compartilhado com ninguém.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {shares.map((share) => (
                <li key={share.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <span className="text-sm">{share.profile.full_name ?? share.profile.email}</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={share.permission}
                      onValueChange={(value) => handlePermissionChange(share.id, value as SharePermission)}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="view">Visualizar</SelectItem>
                        <SelectItem value="edit">Editar</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => handleRevoke(share.id)}>
                      <X className="size-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {candidates.length > 0 && (
            <div className="flex items-center gap-2 border-t pt-3">
              <Select value={selectedUserId} onValueChange={(value) => setSelectedUserId(value ?? "")}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecionar pessoa..." />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name ?? profile.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={permission} onValueChange={(v) => setPermission(v as SharePermission)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="view">Visualizar</SelectItem>
                  <SelectItem value="edit">Editar</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleAdd} disabled={!selectedUserId || loading}>
                Adicionar
              </Button>
            </div>
          )}
          {candidates.length === 0 && shares.length > 0 && (
            <Badge variant="secondary" className="w-fit">
              Todo mundo da equipe já tem acesso
            </Badge>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
