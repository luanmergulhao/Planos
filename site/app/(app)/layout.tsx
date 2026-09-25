import Link from "next/link";
import { requireProfile } from "@/lib/auth/current-user";
import { HeartbeatPing } from "@/components/time/HeartbeatPing";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Toaster } from "@/components/ui/sonner";

const NAV_LINKS = [
  { href: "/prompts", label: "Prompts" },
  { href: "/editais", label: "Triagem" },
  { href: "/manual", label: "Manual" },
  { href: "/horas", label: "Horas" },
  { href: "/notificacoes", label: "Notificações" },
];

function initials(name: string | null, email: string) {
  const source = name?.trim() || email;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user, profile } = await requireProfile();

  const { count: unreadCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("read_at", null);

  return (
    <div className="min-h-screen bg-background">
      <HeartbeatPing />
      <Toaster />
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/planos" className="font-semibold">
              Planos
            </Link>
            <nav className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="hover:text-foreground">
                  {link.label}
                </Link>
              ))}
              {profile.role === "manager" && (
                <Link href="/admin/equipe" className="hover:text-foreground">
                  Equipe
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell initialCount={unreadCount ?? 0} />
            <Link href="/perfil">
              <Avatar className="size-8">
                <AvatarFallback>{initials(profile.full_name, profile.email)}</AvatarFallback>
              </Avatar>
            </Link>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
