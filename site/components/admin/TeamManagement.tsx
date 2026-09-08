"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProfileRole } from "@/lib/supabase/types";

type Member = { id: string; full_name: string | null; email: string; role: ProfileRole };

export function TeamManagement({ members: initialMembers, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [inviting, setInviting] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    const res = await fetch("/api/admin/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name: fullName }),
    });
    setInviting(false);
    const data = await res.json();
    if (!res.ok) {
      toast.error("Não deu pra convidar: " + (data.error ?? "erro"));
      return;
    }
    toast.success(`Convite enviado pra ${email}.`);
    setEmail("");
    setFullName("");
  }

  async function handleRoleChange(memberId: string, role: ProfileRole) {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role } : m)));
    const res = await fetch("/api/admin/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: memberId, role }),
    });
    if (!res.ok) {
      toast.error("Não salvou o cargo.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Convidar pessoa nova</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-name">Nome</Label>
              <Input id="invite-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={inviting}>
              Enviar convite
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipe</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
              <div>
                <p className="text-sm font-medium">{member.full_name ?? member.email}</p>
                <p className="text-xs text-muted-foreground">{member.email}</p>
              </div>
              {member.id === currentUserId ? (
                <Badge variant="secondary">{member.role === "manager" ? "Manager" : "Membro"} (você)</Badge>
              ) : (
                <Select value={member.role} onValueChange={(v) => handleRoleChange(member.id, v as ProfileRole)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
