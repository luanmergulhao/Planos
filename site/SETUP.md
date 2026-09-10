# Setup — Planos & Ponto

Passo a passo pra colocar isso no ar. Cada seção só depende da
anterior. Pode fazer aos poucos.

## 1. Criar o projeto no Supabase

1. Crie uma conta em [supabase.com](https://supabase.com) (dá pra
   entrar com o GitHub).
2. "New project" → escolha um nome (ex: `planos-equipe`), uma senha de
   banco (guarde em local seguro) e a região mais próxima (ex: São
   Paulo/`sa-east-1` se disponível).
3. Espere o projeto terminar de provisionar (~2 min).
4. Em **Project Settings → API**, copie:
   - `Project URL` → vai virar `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → vai virar `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (clique em "Reveal") → vai virar
     `SUPABASE_SERVICE_ROLE_KEY` — **nunca** compartilhe essa fora do
     `.env`/das variáveis de ambiente do Vercel.

## 2. Rodar as migrações (criar as tabelas)

Mais simples pra quem não quer instalar CLI: abra **SQL Editor** no
painel do Supabase e rode, um de cada vez e nessa ordem, o conteúdo de
cada arquivo em `supabase/migrations/`:

1. `0001_init.sql`
2. `0002_sharing_rls.sql`
3. `0003_time_logs.sql`
4. `0004_comments_notifications.sql`
5. `0005_rls_policies.sql`
6. `0006_comment_resolve_rpc.sql`
7. `0007_editais.sql`

(Alternativa, se preferir linha de comando:
`npx supabase link --project-ref <ref>` seguido de
`npx supabase db push`.)

## 3. Criar a primeira conta (você) e virar manager

Como o cadastro é só por convite, a primeiríssima conta precisa ser
criada manualmente:

1. No painel do Supabase: **Authentication → Users → Add user →
   Create new user**. Preencha seu email e uma senha (ou use "Send
   invite email" se preferir definir a senha depois).
2. No **SQL Editor**, rode (trocando o email):
   ```sql
   update profiles set role = 'manager' where email = 'seu@email.com';
   ```
3. Pronto — esse é o usuário que vai conseguir convidar o resto da
   equipe pela tela `/admin/equipe` do site.

## 4. Variáveis de ambiente

Copie `.env.example` pra `.env.local` e preencha com o que você
coletou no passo 1. Pra rodar local:

```powershell
npm install
npm run dev
```

Abra `http://localhost:3000`.

## 5. Email (Resend)

1. Crie conta em [resend.com](https://resend.com) (free tier: 100
   emails/dia).
2. Em **API Keys**, crie uma chave → `RESEND_API_KEY`.
3. Pra começar, pode usar o remetente de teste já incluso em
   `.env.example` (`onboarding@resend.dev`) — funciona, mas só envia
   pro seu próprio email de cadastro no Resend. Pra mandar pra
   qualquer pessoa da equipe, depois verifique um domínio próprio em
   **Domains** e troque `RESEND_FROM_EMAIL`.

## 5.1. Triagem com IA (Gemini)

1. Vá em [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
   (login com Google) → **Create API key**. Tem free tier.
2. Cola em `GEMINI_API_KEY` no `.env.local` (e depois no Vercel também).
3. Sem essa chave, o resto do site funciona normal — só o botão
   "Triagem com IA" na tela de Editais não funciona.

## 6. Deploy (Vercel)

1. Crie o repositório no GitHub (dentro de `projetos/planos-equipe/`,
   que já contém `site/`).
2. Em [vercel.com](https://vercel.com), "Add New Project" → importe o
   repositório.
3. **Root Directory**: aponte pra `site` (o app Next.js não está na
   raiz do repositório).
4. Em **Environment Variables**, adicione as mesmas do `.env.local`,
   mais:
   - `CRON_SECRET`: qualquer string aleatória longa (ex: gerada por
     `openssl rand -hex 32` ou um gerador de senha)
   - `NEXT_PUBLIC_SITE_URL`: a URL final do site (ex:
     `https://planos-equipe.vercel.app`)
5. Deploy. O `vercel.json` já registra o cron diário automaticamente
   (`/api/cron/daily`, 1x por dia) — confirme em **Project Settings →
   Cron Jobs** que apareceu.

## 7. Ligar as notificações por email (Database Webhook)

Isso conecta "alguém te marcou/comentou/prazo vencendo" ao envio de
email de verdade:

1. No painel do Supabase: **Database → Webhooks → Create a new hook**.
2. Nome: `notify-dispatch`. Tabela: `notifications`. Evento: `INSERT`.
3. Tipo: `HTTP Request`. Método: `POST`. URL:
   `https://<sua-url-do-vercel>/api/notify/dispatch`.
4. Em **HTTP Headers**, adicione: `x-automation-secret` =
   (o mesmo valor que você colocou em `CRON_SECRET` no Vercel).
5. Salve.

## 8. Testar

1. Entre com a conta manager, confirme que seu Plano abriu com as 8
   categorias padrão (A–G1).
2. Crie uma segunda conta de teste (convide pela tela Equipe), aceite
   o convite (email chega via Supabase Auth, template padrão), faça
   login.
3. Compartilhe seu Plano com essa segunda conta, teste ver/editar.
4. Comente numa tarefa e marque a segunda conta — confirme que a
   notificação aparece pra ela (sininho, `/notificacoes`) e, se o
   webhook do passo 7 estiver certo, que o email chega.
5. Pra testar o cron sem esperar o horário agendado, chame manualmente:
   ```powershell
   curl -H "Authorization: Bearer <CRON_SECRET>" https://<sua-url>/api/cron/daily
   ```
