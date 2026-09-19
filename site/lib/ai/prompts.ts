// Acesso aos prompts: quem manda é o que está no banco (editável pela
// aba Prompts). O texto do código só serve de padrão inicial e de rede
// de segurança se a linha sumir.

import { createAdminClient } from "@/lib/supabase/admin";
import { PROMPTS_PADRAO, type PromptId } from "@/lib/ai/prompts-padrao";

/** Troca {{variavel}} pelo valor. Variável sem valor vira string vazia. */
export function renderPrompt(texto: string, valores: Record<string, string>): string {
  return texto.replace(/\{\{(\w+)\}\}/g, (_, nome: string) => valores[nome] ?? "");
}

/** Copia pro banco os prompts que ainda não estão lá, sem tocar nos que já existem. */
export async function ensurePromptsSeeded() {
  const admin = createAdminClient();
  await admin.from("prompts").upsert(
    PROMPTS_PADRAO.map((p) => ({
      id: p.id,
      nome: p.nome,
      descricao: p.descricao,
      conteudo: p.conteudo,
      variaveis: p.variaveis,
    })),
    { onConflict: "id", ignoreDuplicates: true }
  );
}

export async function getPromptTexto(id: PromptId): Promise<string> {
  const padrao = PROMPTS_PADRAO.find((p) => p.id === id);
  if (!padrao) throw new Error(`prompt desconhecido: ${id}`);

  try {
    const admin = createAdminClient();
    const { data } = await admin.from("prompts").select("conteudo").eq("id", id).maybeSingle();
    if (data?.conteudo) return data.conteudo;

    // primeira vez: leva os padrões pro banco pra ficarem editáveis
    await ensurePromptsSeeded();
  } catch {
    // banco fora do ar ou tabela ainda não criada — segue com o padrão
  }

  return padrao.conteudo;
}
