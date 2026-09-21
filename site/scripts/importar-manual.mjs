#!/usr/bin/env node
// Converte o .docx do manual da equipe em seções HTML e, se pedido, grava
// no Supabase (tabelas manual_secoes / manual_segredos, migração 0014).
//
// O que ele faz com o documento:
//  - descarta TODO texto riscado (o que está riscado no manual não vale);
//  - ignora as sugestões pendentes do Google Docs (mantém o texto original:
//    inserções sugeridas ficam de fora, exclusões sugeridas voltam);
//  - tira as senhas do HTML e guarda cada uma em manual_segredos, deixando
//    o marcador [[seg:N]] no lugar;
//  - troca as imagens por um aviso (as imagens ainda não são importadas).
//
// Uso:
//   node scripts/importar-manual.mjs <manual.docx> --saida <pasta>     (só confere)
//   node scripts/importar-manual.mjs <manual.docx> --gravar            (grava no banco)
//   ... --liberar <email>   dá a essa pessoa acesso às senhas (profiles.pode_ver_segredos)
//
// NUNCA commitar o .docx nem a pasta de saída: o repositório é público e o
// manual tem senhas e dados pessoais.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const mammoth = require("mammoth");
const JSZip = require("jszip");

const args = process.argv.slice(2);
const arquivo = args.find((a) => !a.startsWith("--") && a.toLowerCase().endsWith(".docx"));
const opt = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? (args[i + 1]?.startsWith("--") ? true : (args[i + 1] ?? true)) : undefined;
};
const pastaSaida = opt("--saida");
const gravar = args.includes("--gravar");
const liberar = opt("--liberar");

if (!arquivo || (!pastaSaida && !gravar && !liberar)) {
  console.error("Uso: node scripts/importar-manual.mjs <manual.docx> [--saida <pasta>] [--gravar] [--liberar <email>]");
  process.exit(1);
}

// ---------------------------------------------------------------------
// 0) numeração das listas: a., b., i., ii., 1.1 ... exatamente como no
//    documento (o conversor padrão trocaria tudo por 1., 2., 3.)
// ---------------------------------------------------------------------
function carregarNumeracao(xml) {
  const abstratas = {};
  for (const m of xml.matchAll(/<w:abstractNum\b[^>]*w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
    const niveis = {};
    for (const l of m[2].matchAll(/<w:lvl\b[^>]*w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
      niveis[l[1]] = {
        fmt: (l[2].match(/<w:numFmt w:val="([^"]+)"/) || [])[1] || "decimal",
        texto: (l[2].match(/<w:lvlText w:val="([^"]*)"/) || [])[1] ?? "",
        inicio: Number((l[2].match(/<w:start w:val="(\d+)"/) || [])[1] ?? 1),
      };
    }
    abstratas[m[1]] = niveis;
  }
  const nums = {};
  for (const m of xml.matchAll(/<w:num\b[^>]*w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
    nums[m[1]] = {
      abstrata: (m[2].match(/<w:abstractNumId w:val="(\d+)"/) || [])[1],
      reinicia: /startOverride/.test(m[2]),
    };
  }
  return { abstratas, nums };
}

const letras = (n) => String.fromCharCode(96 + (((n - 1) % 26) + 1)).repeat(Math.floor((n - 1) / 26) + 1);
function romano(n) {
  const t = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
  let r = "";
  for (const [v, s] of t) while (n >= v) { r += s; n -= v; }
  return r;
}
function formatarNumero(n, fmt) {
  if (fmt === "lowerLetter") return letras(n);
  if (fmt === "upperLetter") return letras(n).toUpperCase();
  if (fmt === "lowerRoman") return romano(n);
  if (fmt === "upperRoman") return romano(n).toUpperCase();
  return String(n);
}

function aplicarNumeracao(docXml, numXml) {
  const { abstratas, nums } = carregarNumeracao(numXml);
  const contadores = {};
  const temTextoValido = (p) =>
    (p.match(/<w:r\b[\s\S]*?<\/w:r>/g) || []).some(
      (r) => !/<w:strike\/>|<w:strike w:val="(1|true)"\/>/.test(r) && /<w:t\b[^>]*>[^<]*\S[^<]*<\/w:t>/.test(r)
    );

  return docXml.replace(/<w:p\b[\s\S]*?<\/w:p>/g, (p) => {
    const np = p.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/);
    if (!np) return p;
    const ilvl = (np[1].match(/<w:ilvl w:val="(\d+)"/) || [])[1] ?? "0";
    const numId = (np[1].match(/<w:numId w:val="(\d+)"/) || [])[1];
    const semNumeracao = p.replace(/<w:numPr>[\s\S]*?<\/w:numPr>/, "");
    const num = nums[numId];
    if (!num || numId === "0") return semNumeracao;
    const niveis = abstratas[num.abstrata];
    if (!niveis || !niveis[ilvl]) return semNumeracao;

    // a numeração avança mesmo quando o parágrafo está riscado (como no documento)
    const chave = num.reinicia ? "n" + numId : "a" + num.abstrata;
    const c = (contadores[chave] ||= []);
    const i = Number(ilvl);
    c[i] = (c[i] ?? niveis[i].inicio - 1) + 1;
    c.length = i + 1;

    if (!temTextoValido(p)) return semNumeracao;

    const nivel = niveis[ilvl];
    let rotulo;
    if (nivel.fmt === "bullet" || nivel.fmt === "none") {
      rotulo = /[-]/.test(nivel.texto) || !nivel.texto.trim() ? "•" : nivel.texto;
    } else {
      rotulo = nivel.texto.replace(/%(\d)/g, (_, d) => {
        const k = Number(d) - 1;
        return formatarNumero(c[k] ?? niveis[k]?.inicio ?? 1, niveis[k]?.fmt ?? "decimal");
      });
    }
    const run = `<w:r><w:t xml:space="preserve">§§L${ilvl}§§${rotulo} </w:t></w:r>`;
    return semNumeracao.includes("</w:pPr>") ? semNumeracao.replace("</w:pPr>", "</w:pPr>" + run) : semNumeracao.replace(/(<w:p\b[^>]*>)/, "$1" + run);
  });
}

// ---------------------------------------------------------------------
// 1) sugestões pendentes: fica o texto original
// ---------------------------------------------------------------------
async function docxSemSugestoes(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  let xml = await zip.file("word/document.xml").async("string");
  xml = xml.replace(/<w:ins\b[^>]*\/>/g, "").replace(/<w:del\b[^>]*\/>/g, ""); // marcas de parágrafo
  xml = xml.replace(/<w:ins\b[^>]*>[\s\S]*?<\/w:ins>/g, ""); // inserções sugeridas: fora
  xml = xml.replace(/<w:del\b[^>]*>([\s\S]*?)<\/w:del>/g, (_, dentro) =>
    dentro.replace(/<w:delText\b/g, "<w:t").replace(/<\/w:delText>/g, "</w:t>")
  ); // exclusões sugeridas: o texto original volta
  const numeracao = zip.file("word/numbering.xml");
  if (numeracao) xml = aplicarNumeracao(xml, await numeracao.async("string"));
  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

// ---------------------------------------------------------------------
// 2) docx -> html
// ---------------------------------------------------------------------
const styleMap = [
  "strikethrough => s",
  "p[style-name='Title'] => h1.tit:fresh",
  "p[style-name='Subtitle'] => p.sub:fresh",
  "p[style-name='Heading 1'] => h2:fresh",
  "p[style-name='heading 1'] => h2:fresh",
  "p[style-name='Heading 2'] => h3:fresh",
  "p[style-name='heading 2'] => h3:fresh",
  "p[style-name='Heading 3'] => h4:fresh",
  "p[style-name='heading 3'] => h4:fresh",
  "p[style-name='Heading 4'] => h5:fresh",
  "p[style-name='heading 4'] => h5:fresh",
];

const IMAGEM = '<em class="manual-imagem">[imagem do manual — ainda não importada]</em>';

const semTags = (html) =>
  html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function limpar(html) {
  let h = html.replace(/<s>[\s\S]*?<\/s>/g, ""); // riscado não vale
  h = h.replace(/<img\b[^>]*>/g, IMAGEM);
  // marcador de nível da lista -> classe de recuo
  h = h.replace(/<(p|h[2-6])>§§L(\d)§§/g, '<$1 class="nivel-$2">').replace(/§§L\d§§/g, "");
  let anterior;
  do {
    anterior = h;
    h = h
      .replace(/<(strong|em|u|sup|sub|a)\b[^>]*>\s*<\/\1>/g, "")
      .replace(/<(p|li|h[1-6])\b[^>]*>(\s|&nbsp;)*<\/\1>/g, "")
      .replace(/<(ul|ol)\b[^>]*>\s*<\/\1>/g, "")
      .replace(/<(td|th)\b[^>]*>\s*<\/\1>/g, "<$1></$1>")
      .replace(/<tr\b[^>]*>\s*<\/tr>/g, "")
      .replace(/<(tbody|thead)\b[^>]*>\s*<\/\1>/g, "")
      .replace(/<table\b[^>]*>\s*<\/table>/g, "");
  } while (h !== anterior);
  // só http(s) e mailto viram link; o resto vira texto
  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/g, (_, attrs, texto) => {
    const href = (attrs.match(/href="([^"]*)"/) || [])[1];
    if (href && /^(https?:\/\/|mailto:)/i.test(href)) {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${texto}</a>`;
    }
    return texto;
  });
  return h.trim();
}

// ---------------------------------------------------------------------
// 3) seções e grupos (as abas do Google)
// ---------------------------------------------------------------------
function dividirEmSecoes(html) {
  const partes = html.split(/(<h1 class="tit">[\s\S]*?<\/h1>)/);
  const secoes = [];
  let atual = { titulo: "(início)", html: "" };
  for (let i = 0; i < partes.length; i++) {
    const parte = partes[i];
    const m = parte.match(/^<h1 class="tit">([\s\S]*?)<\/h1>$/);
    if (!m) {
      atual.html += parte;
      continue;
    }
    const titulo = semTags(m[1]);
    // "Title" com cara de frase (tem ":" ou é comprido) é só um parágrafo mal estilizado
    if (!titulo || titulo.length > 60 || titulo.includes(":")) {
      atual.html += `<p><strong>${m[1]}</strong></p>`;
      continue;
    }
    secoes.push(atual);
    atual = { titulo, html: "" };
  }
  secoes.push(atual);
  return secoes.filter((s) => s.titulo !== "(início)" || semTags(s.html));
}

// ---------------------------------------------------------------------
// 4) senhas
// ---------------------------------------------------------------------
const SENHA_CONHECIDA = /\b(?:Sucesso\d*!|Dnarchive\w*!)/g;
const SENHA_GENERICA = /\b((?:senha|password)[^:<]{0,25}:\s*)([^\s<|,;]+)/gi;

function tirarSenhas(html, novoId, segredos) {
  const marcar = (valor) => {
    const id = novoId();
    segredos.push({ id, valor });
    return `[[seg:${id}]]`;
  };
  // "senha: X" com X que parece senha (não e-mail, link ou marcação de negrito)
  const pareceSenha = (v) => v.length >= 6 && !v.includes("@") && !/^https?:/i.test(v) && /[A-Za-z0-9]/.test(v);
  return html
    .split(/(<[^>]+>)/)
    .map((pedaco) => {
      if (pedaco.startsWith("<")) return pedaco;
      // primeiro o padrão genérico, antes de existir qualquer marcador no texto
      // (senão o "seg:" do marcador seria lido como o ":" de "senha:")
      let t = pedaco.replace(SENHA_GENERICA, (todo, prefixo, valor) => (pareceSenha(valor) ? prefixo + marcar(valor) : todo));
      t = t.replace(SENHA_CONHECIDA, (v) => marcar(v));
      return t;
    })
    .join("");
}

// ---------------------------------------------------------------------
// principal
// ---------------------------------------------------------------------
const original = fs.readFileSync(arquivo);
const buffer = await docxSemSugestoes(original);
const { value: htmlBruto, messages } = await mammoth.convertToHtml({ buffer }, { styleMap, includeDefaultStyleMap: true });

const brutas = dividirEmSecoes(htmlBruto);
const secoes = [];
const segredos = [];
let proximoId = 1;
let grupoAtual = null;
const descartadas = [];

for (const s of brutas) {
  const html = limpar(s.html);
  const texto = semTags(html);
  if (texto.length === 0) {
    // aba-mãe do Google (só o título): as seguintes ficam dentro dela
    grupoAtual = s.titulo;
    continue;
  }
  if (texto.length < 40) {
    descartadas.push(`${s.titulo} (${texto.length} caracteres)`);
    continue;
  }
  const ehPrimeiraAbaSemGrupo = secoes.length < 8 && grupoAtual === null;
  const meusSegredos = [];
  const htmlSemSenhas = tirarSenhas(html, () => proximoId++, meusSegredos);
  secoes.push({
    ordem: secoes.length + 1,
    grupo: ehPrimeiraAbaSemGrupo ? null : grupoAtual,
    titulo: s.titulo,
    html: htmlSemSenhas,
    em_revisao: /Controle de Resultado/i.test(s.titulo),
    segredos: meusSegredos,
    caracteres: texto.length,
  });
  segredos.push(...meusSegredos);
}

// conferência: sobrou alguma linha com "senha" sem marcador?
const suspeitas = [];
for (const s of secoes) {
  for (const linha of s.html.split(/<\/(?:p|li|td|h\d)>/)) {
    const t = semTags(linha);
    if (/senha|password/i.test(t) && !/\[\[seg:\d+\]\]/.test(t)) suspeitas.push(`${s.titulo}: ${t.slice(0, 70)}`);
  }
}

console.log("Seções importáveis:", secoes.length, "| caracteres visíveis:", secoes.reduce((n, s) => n + s.caracteres, 0));
console.log("Senhas separadas:", segredos.length, "(em", secoes.filter((s) => s.segredos.length).length, "seções)");
console.log("Seções quase vazias, não importadas:", descartadas.join("; ") || "nenhuma");
console.log("Avisos do conversor:", messages.length);
console.log("Linhas com a palavra 'senha' SEM marcador (conferir):", suspeitas.length);
suspeitas.slice(0, 10).forEach((s) => console.log("  ?", s));

// ---------------------------------------------------------------------
// saída de conferência (fora do projeto!)
// ---------------------------------------------------------------------
if (pastaSaida && typeof pastaSaida === "string") {
  fs.mkdirSync(pastaSaida, { recursive: true });
  const mascarado = (html) => html.replace(/\[\[seg:\d+\]\]/g, "••••••••");
  const pagina = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Manual (conferência)</title>
<style>body{font:15px/1.6 system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem}
h1{border-top:3px solid #333;padding-top:1rem;margin-top:2.5rem}.g{color:#888;font-size:12px;text-transform:uppercase}
table{border-collapse:collapse}td,th{border:1px solid #bbb;padding:4px 8px}.manual-imagem{color:#888}</style>
${secoes
  .map((s) => `<p class="g">${s.grupo ?? ""}</p><h1>${s.ordem}. ${s.titulo}${s.em_revisao ? " (em revisão)" : ""}</h1>${mascarado(s.html)}`)
  .join("\n")}`;
  fs.writeFileSync(path.join(pastaSaida, "manual-conferencia.html"), pagina);
  fs.writeFileSync(
    path.join(pastaSaida, "manual-resumo.json"),
    JSON.stringify(
      secoes.map((s) => ({
        ordem: s.ordem,
        grupo: s.grupo,
        titulo: s.titulo,
        em_revisao: s.em_revisao,
        caracteres: s.caracteres,
        senhas: s.segredos.length,
      })),
      null,
      2
    )
  );
  console.log("Arquivos de conferência em:", pastaSaida);
}

// ---------------------------------------------------------------------
// gravação
// ---------------------------------------------------------------------
if (gravar || liberar) {
  const siteDir = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
  const env = Object.fromEntries(
    fs
      .readFileSync(path.join(siteDir, ".env.local"), "utf8")
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)])
  );
  const { createClient } = require("@supabase/supabase-js");
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  if (gravar) {
    const semTabela = await sb.from("manual_secoes").select("id", { head: true, count: "exact" });
    if (semTabela.error) {
      console.error("A tabela manual_secoes não existe ainda. Rode a migração 0014_manual.sql no Supabase primeiro.");
      process.exit(1);
    }
    // reimportar = trocar tudo (o segredos apaga junto, por cascade)
    const del = await sb.from("manual_secoes").delete().not("id", "is", null);
    if (del.error) throw del.error;

    for (const s of secoes) {
      const { data, error } = await sb
        .from("manual_secoes")
        .insert({ ordem: s.ordem, grupo: s.grupo, titulo: s.titulo, html: s.html, em_revisao: s.em_revisao })
        .select("id")
        .single();
      if (error) throw error;
      if (s.segredos.length) {
        const r = await sb.from("manual_segredos").insert(s.segredos.map((x) => ({ id: x.id, secao_id: data.id, valor: x.valor })));
        if (r.error) throw r.error;
      }
    }
    console.log("Gravado no banco:", secoes.length, "seções e", segredos.length, "senhas.");
  }

  if (liberar && typeof liberar === "string") {
    const r = await sb.from("profiles").update({ pode_ver_segredos: true }).eq("email", liberar).select("email");
    if (r.error) throw r.error;
    console.log("Acesso às senhas liberado para:", (r.data ?? []).map((p) => p.email).join(", ") || "(ninguém encontrado)");
  }
}
