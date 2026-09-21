#!/usr/bin/env node
// Lê uma planilha BAIXADA do Drive (.xlsx) e manda pro site, pelo mesmo
// caminho do script do Google Sheets (POST /api/sync/planilha). Serve
// quando o Apps Script não dá pra usar (por exemplo, a triagem ainda é .xlsx).
//
// Sem --enviar ele só CONFERE: mostra as abas, as colunas que ficam, as que
// são cortadas (login/senha) e quantas linhas, sem mostrar nenhuma célula.
//
// Uso:
//   node scripts/importar-planilha.mjs <arquivo.xlsx> --planilha triagem|inscritos
//   node scripts/importar-planilha.mjs <arquivo.xlsx> --planilha triagem --enviar
//   (opcional) --url http://localhost:3000/api/sync/planilha   para testar local
//
// Colunas de login e senha são cortadas AQUI, antes de sair do computador.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import { ehColunaSecreta, PLANILHAS } from "../lib/planilhas.ts";

const args = process.argv.slice(2);
const arquivo = args.find((a) => a.toLowerCase().endsWith(".xlsx"));
const opt = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const planilha = opt("--planilha");
const enviar = args.includes("--enviar");
const url = opt("--url") ?? "https://planos-planos1.vercel.app/api/sync/planilha";

if (!arquivo || !PLANILHAS.includes(planilha)) {
  console.error(`Uso: node scripts/importar-planilha.mjs <arquivo.xlsx> --planilha ${PLANILHAS.join("|")} [--enviar]`);
  process.exit(1);
}

const TAMANHO_LOTE = 100; // células de resumo são longas; lote pequeno cabe no limite da Vercel

// ---------------------------------------------------------------------
// texto de uma célula (fórmula, texto formatado, link e data viram texto simples)
// ---------------------------------------------------------------------
const doisDigitos = (n) => String(n).padStart(2, "0");
function formatarData(d) {
  const dia = `${doisDigitos(d.getUTCDate())}/${doisDigitos(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  const temHora = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0;
  return temHora ? `${dia} ${doisDigitos(d.getUTCHours())}:${doisDigitos(d.getUTCMinutes())}` : dia;
}
const juntarTrechos = (rt) => (rt?.richText ?? []).map((t) => t.text).join("");

function textoDaCelula(celula) {
  const v = celula.value;
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return formatarData(v);
  if (typeof v !== "object") return String(v);
  if ("richText" in v) return juntarTrechos(v);
  if ("error" in v) return String(v.error);
  if ("result" in v) {
    const r = v.result;
    if (r === null || r === undefined) return "";
    if (r instanceof Date) return formatarData(r);
    if (typeof r === "object") return "error" in r ? String(r.error) : juntarTrechos(r);
    return String(r);
  }
  if ("hyperlink" in v) {
    const texto = typeof v.text === "string" ? v.text : juntarTrechos(v.text);
    return texto.includes(v.hyperlink) ? texto : `${texto} ${v.hyperlink}`.trim();
  }
  if ("text" in v) return typeof v.text === "string" ? v.text : juntarTrechos(v.text);
  return "";
}

// ---------------------------------------------------------------------
// lê o arquivo
// ---------------------------------------------------------------------
const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(arquivo);

const abas = [];
for (const ws of wb.worksheets) {
  if (ws.state !== "visible") continue;

  const linhas = []; // linhas[n-1] = células da linha n (0-based nas colunas)
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const celulas = [];
    for (let c = 1; c <= ws.columnCount; c++) celulas.push(textoDaCelula(row.getCell(c)));
    linhas[n - 1] = celulas;
  });
  for (let i = 0; i < linhas.length; i++) linhas[i] ??= [];

  // cabeçalho = primeira linha com mais de 3 células preenchidas
  const h = linhas.findIndex((l) => l.filter((x) => x.trim()).length > 3);
  if (h < 0) continue;

  const manter = [];
  const cortadas = [];
  linhas[h].forEach((nome, c) => {
    const n = nome.trim();
    if (n && ehColunaSecreta(n)) cortadas.push(n.replace(/\s+/g, " ").slice(0, 40));
    else manter.push(c);
  });

  abas.push({
    nome: ws.name,
    linhaDoCabecalho: h + 1,
    cabecalho: manter.map((c) => linhas[h][c]),
    dados: linhas.slice(h + 1).map((l) => manter.map((c) => l[c] ?? "")),
    cortadas,
  });
}

console.log(`Arquivo: ${path.basename(arquivo)} | destino: ${planilha} | abas visíveis com dados: ${abas.length}`);
for (const a of abas) {
  const comConteudo = a.dados.filter((l) => l.some((x) => x.trim())).length;
  console.log(
    `  - "${a.nome}": cabeçalho na linha ${a.linhaDoCabecalho}, ${a.cabecalho.length} colunas mantidas, ${comConteudo} linhas com conteúdo` +
      (a.cortadas.length ? ` | CORTADAS: ${a.cortadas.join(", ")}` : "")
  );
  if (args.includes("--cabecalhos")) {
    console.log("      colunas:", a.cabecalho.map((x) => x.replace(/\s+/g, " ").slice(0, 40)).join(" | "));
  }
}

if (!enviar) {
  console.log("\n(Só conferência. Para enviar de verdade, rode de novo com --enviar.)");
  process.exit(0);
}

// ---------------------------------------------------------------------
// envia
// ---------------------------------------------------------------------
const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const segredo = fs
  .readFileSync(path.join(siteDir, ".env.local"), "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("SYNC_SECRET="))
  ?.slice("SYNC_SECRET=".length)
  .trim();
if (!segredo) {
  console.error("SYNC_SECRET não encontrado no .env.local");
  process.exit(1);
}

async function postar(corpo) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-sync-secret": segredo },
    body: JSON.stringify(corpo),
  });
  if (!res.ok) throw new Error(`o site respondeu ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

let total = 0;
for (const a of abas) {
  const primeiraLinhaDaAba = a.linhaDoCabecalho + 1;
  if (a.dados.length === 0) {
    await postar({ tipo: "lote", planilha, aba: a.nome, cabecalho: a.cabecalho, primeiraLinha: primeiraLinhaDaAba, linhas: [], primeiro: true });
  }
  for (let i = 0; i < a.dados.length; i += TAMANHO_LOTE) {
    const r = await postar({
      tipo: "lote",
      planilha,
      aba: a.nome,
      cabecalho: a.cabecalho,
      primeiraLinha: primeiraLinhaDaAba + i,
      linhas: a.dados.slice(i, i + TAMANHO_LOTE),
      primeiro: i === 0,
    });
    total += r.recebidas ?? 0;
  }
  console.log(`  enviada: "${a.nome}"`);
}
await postar({ tipo: "fim", planilha, abas: abas.map((a) => a.nome) });
console.log(`Pronto: ${total} linhas enviadas para '${planilha}'.`);
