# Planos & Ponto

Site interno da equipe: Plano por pessoa (categorias A–G1 com tarefas
numeradas automaticamente), compartilhamento, ponto automático
(login/logout → horas por dia/mês), comentários com menção, e
automações (lembrete de prazo, notificação de menção, resumo diário).

- **Arquitetura completa e decisões**: `../CLAUDE.md` e o plano em
  `C:\Users\luanm\.claude\plans\vamos-la-eu-trabalho-optimized-volcano.md`
- **Colocar no ar (Supabase, Vercel, email, primeiro usuário)**:
  [`SETUP.md`](./SETUP.md)

## Rodando local

```powershell
npm install
npm run dev
```

Precisa de um `.env.local` preenchido — veja `.env.example` e o passo
1–2 de `SETUP.md`.

## Stack

Next.js 15 (App Router) · Supabase (Postgres + Auth + RLS) · Vercel
(deploy + cron) · Tailwind + shadcn/ui · Resend (email).
