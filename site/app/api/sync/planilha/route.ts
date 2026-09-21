import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { espelharLote, PLANILHAS, type PlanilhaId } from "@/lib/planilhas";

// Recebe as planilhas do Drive, enviadas por um script dentro da planilha
// (scripts/apps-script/enviar-planilha.gs). Só aceita quem sabe o
// SYNC_SECRET. Duas mensagens:
//   { tipo: "lote", planilha, aba, cabecalho, primeiraLinha, linhas, primeiro }
//   { tipo: "fim",  planilha, abas: ["nome", ...] }   -> tira abas que sumiram

export const maxDuration = 60;

const igual = (a: string, b: string) => {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
};

const ehPlanilha = (v: unknown): v is PlanilhaId => typeof v === "string" && (PLANILHAS as readonly string[]).includes(v);
const ehTexto = (v: unknown): v is string => typeof v === "string";
const ehListaDeTexto = (v: unknown): v is string[] => Array.isArray(v) && v.every(ehTexto);

export async function POST(request: NextRequest) {
  const segredo = process.env.SYNC_SECRET;
  if (!segredo || !igual(request.headers.get("x-sync-secret") ?? "", segredo)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { tipo, planilha } = corpo;
  if (!ehPlanilha(planilha)) return NextResponse.json({ error: "planilha desconhecida" }, { status: 400 });

  const admin = createAdminClient();

  if (tipo === "fim") {
    if (!ehListaDeTexto(corpo.abas)) return NextResponse.json({ error: "abas inválidas" }, { status: 400 });
    const abas = corpo.abas;

    const { data: existentes } = await admin.from("planilhas_linhas").select("aba").eq("planilha", planilha);
    const sumiram = [...new Set((existentes ?? []).map((r) => r.aba))].filter((a) => !abas.includes(a));
    for (const aba of sumiram) await admin.from("planilhas_linhas").delete().eq("planilha", planilha).eq("aba", aba);

    const { data: sync } = await admin.from("planilhas_sync").select("abas").eq("planilha", planilha).maybeSingle();
    const atuais = (sync?.abas ?? {}) as Record<string, unknown>;
    const mantidas = Object.fromEntries(Object.entries(atuais).filter(([nome]) => abas.includes(nome)));
    await admin
      .from("planilhas_sync")
      .upsert({ planilha, abas: mantidas, ultima_sync: new Date().toISOString() }, { onConflict: "planilha" });

    return NextResponse.json({ ok: true, abasRemovidas: sumiram.length });
  }

  if (tipo !== "lote") return NextResponse.json({ error: "tipo desconhecido" }, { status: 400 });

  const { aba, cabecalho, primeiraLinha, linhas, primeiro } = corpo;
  if (
    !ehTexto(aba) ||
    aba.length === 0 ||
    aba.length > 100 ||
    !ehListaDeTexto(cabecalho) ||
    cabecalho.length > 120 ||
    typeof primeiraLinha !== "number" ||
    !Array.isArray(linhas) ||
    linhas.length > 1000 ||
    !linhas.every(ehListaDeTexto)
  ) {
    return NextResponse.json({ error: "lote inválido" }, { status: 400 });
  }

  if (primeiro === true) {
    await admin.from("planilhas_linhas").delete().eq("planilha", planilha).eq("aba", aba);
  }

  const lote = espelharLote(cabecalho, linhas as string[][], primeiraLinha);
  const agora = new Date().toISOString();
  const registros = lote.linhas.map((l) => ({ planilha, aba, linha: l.linha, dados: l.dados, sincronizado_em: agora }));

  for (let i = 0; i < registros.length; i += 200) {
    const { error } = await admin.from("planilhas_linhas").upsert(registros.slice(i, i + 200), { onConflict: "planilha,aba,linha" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // guarda o resumo da aba (colunas, quantas linhas já entraram)
  const { count } = await admin
    .from("planilhas_linhas")
    .select("linha", { count: "exact", head: true })
    .eq("planilha", planilha)
    .eq("aba", aba);
  const { data: sync } = await admin.from("planilhas_sync").select("abas").eq("planilha", planilha).maybeSingle();
  const abas = { ...((sync?.abas ?? {}) as Record<string, unknown>) };
  abas[aba] = { linhas: count ?? 0, colunas: lote.colunas, descartadas: lote.descartadas };
  await admin.from("planilhas_sync").upsert({ planilha, abas, ultima_sync: agora }, { onConflict: "planilha" });

  return NextResponse.json({ ok: true, recebidas: registros.length, colunasDescartadas: lote.descartadas });
}
