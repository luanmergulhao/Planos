# Briefing — Planos & Ponto (equipe ONG)

## Sobre

Site interno pra equipe de produção cultural de uma ONG. Substitui o
"Planos" que hoje roda em Google Docs/Sheets: um documento por pessoa,
organizado em categorias com letra (A, B, C... G, G1...), onde cada
tarefa nova ganha o próximo número dentro da sua categoria (ex: a
terceira tarefa em D vira "D3"). Mantém comentários ancorados com
menção a colegas, como no Google Docs, e adiciona o que faltava:
controle de acesso por pessoa, ponto (login/logout) automático, horas
trabalhadas por dia/mês, e automações (lembrete de prazo, notificação
de menção, resumo diário).

## Tipo

Projeto interno (uso da equipe, não é entrega pra cliente externo).

## Entregas previstas

- Site (Next.js + Supabase + Vercel) com:
  - Login por pessoa, 1 Plano por pessoa, compartilhamento view/edit
  - Editor por categorias com numeração automática de tarefas (G1, F2, D3...)
  - Comentários ancorados por tarefa, com @menção
  - Registro automático de horário de login/logout (ponto) e cálculo
    de horas trabalhadas por dia e por mês
  - Notificações (menção, comentário, lembrete de prazo, resumo diário)

## Onde salvar o que

- Código do site: `projetos/planos-equipe/site/`
- Contexto do projeto: `projetos/planos-equipe/CLAUDE.md`
- Plano de implementação completo (arquitetura, modelo de dados,
  fases): `C:\Users\luanm\.claude\plans\vamos-la-eu-trabalho-optimized-volcano.md`

## Contexto que herda da raiz

Nenhum por enquanto — a `_memoria/` e `identidade/design-guide.md` da
raiz (MazyOS) ainda estão vazias e são de outro negócio (agência de
marketing), não da ONG. Esse projeto define seu próprio contexto
abaixo em vez de depender da raiz.

## Específico desse projeto

- Idioma da interface: pt-BR, mantendo o vocabulário que a equipe já
  usa (nomes de categoria em português, ex: "G1. INTELIGÊNCIA
  ARTIFICIAL").
- Sem edição em tempo real (não é Google Docs de verdade) — autosave +
  "editado por X há Y min".
- WhatsApp como canal de notificação fica pra fase 2 — o esquema de
  banco já reserva espaço pra isso, mas não implementar agora.
- Contas externas necessárias: GitHub (o usuário já tem), Supabase e
  Vercel (ainda precisam ser criadas — perguntar antes de qualquer
  passo que dependa delas).
