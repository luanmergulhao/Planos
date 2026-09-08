# Planos & Ponto — contexto do projeto

Projeto interno pra equipe de produção cultural de uma ONG. Ver
`briefing.md` nesta pasta pro resumo de escopo, e o plano completo em
`C:\Users\luanm\.claude\plans\vamos-la-eu-trabalho-optimized-volcano.md`
pra arquitetura, modelo de dados e fases de construção.

Este projeto **não** herda `_memoria/` nem `identidade/` da raiz do
workspace — aquilo é de outro negócio (agência de marketing via
MazyOS), ainda vazio. Este projeto define seu próprio contexto abaixo.

## Stack

Next.js 15 (App Router, TypeScript) + Supabase (Postgres/Auth/RLS) +
Vercel (deploy + cron) + Tailwind/shadcn + Resend (email). Código em
`site/`.

## Regras específicas

- Interface em pt-BR. Categorias do Plano usam letra + número
  sequencial dentro da categoria (A, B, C... G1, G2, F2, D3...) — ao
  criar uma tarefa nova, o número é sempre `max(item_number) + 1`
  dentro daquela categoria, nunca digitado manualmente.
- Sem colaboração em tempo real — autosave + "editado por X há Y min".
- Permissões (quem vê/edita o Plano de quem) são aplicadas via Row
  Level Security no Postgres, não só na camada de aplicação.
- Prazo de tarefa é sempre um campo de data estruturado
  (`<input type="date">` → coluna `deadline_at`), nunca texto livre
  interpretado por IA.
- Canal de notificação é abstraído (`lib/notifications/`) pra permitir
  adicionar WhatsApp na fase 2 sem reescrever a lógica de mention/cron
  já existente.
- Sem cadastro público — só convite (manager convida pela tela
  `/admin/equipe`).

## Contas externas

- GitHub: já existe conta do usuário.
- Supabase e Vercel: ainda não criadas — confirmar com o usuário antes
  de qualquer passo que dependa delas (criar projeto, pegar chaves,
  configurar deploy).
