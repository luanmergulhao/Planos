/**
 * Envia esta planilha para o site (Planos & Ponto), todo dia de manhã.
 *
 * COMO INSTALAR (uma vez por planilha):
 *  1. Abra a planilha (tem que ser Google Sheets, não .xlsx).
 *  2. Extensões → Apps Script. Apague o que estiver lá e cole este arquivo inteiro.
 *  3. Engrenagem (Configurações do projeto) → "Propriedades do script" → adicione:
 *       SYNC_URL    = https://planos-planos1.vercel.app/api/sync/planilha
 *       SYNC_SECRET = (o segredo que o Claude te passou)
 *       PLANILHA    = inscritos      <- na planilha de inscritos
 *                     triagem        <- na planilha de triagem
 *  4. Escolha a função "enviarPlanilha" no topo e clique em Executar (autorize quando pedir).
 *  5. Depois rode "criarGatilhoDiario" uma vez: ela agenda o envio todo dia às 6h.
 *
 * O QUE ELE FAZ: lê as abas visíveis, CORTA as colunas de login e senha
 * (elas nunca saem da planilha) e manda o resto. Só lê; nunca escreve na planilha.
 */

// Coluna cujo cabeçalho combina com isso nunca é enviada.
var BLOQUEADAS = /(senha|password|passwd|login|usu[aá]rio|username|token|chave)/i;
var TAMANHO_LOTE = 300;

function enviarPlanilha() {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty("SYNC_URL");
  var segredo = props.getProperty("SYNC_SECRET");
  var planilha = props.getProperty("PLANILHA");
  if (!url || !segredo || !planilha) {
    throw new Error("Faltam propriedades do script: SYNC_URL, SYNC_SECRET e PLANILHA.");
  }

  var abasEnviadas = [];
  var abas = SpreadsheetApp.getActiveSpreadsheet().getSheets().filter(function (a) {
    return !a.isSheetHidden();
  });

  abas.forEach(function (aba) {
    var valores = aba.getDataRange().getDisplayValues();
    // cabeçalho = primeira linha com mais de 3 células preenchidas
    var h = -1;
    for (var i = 0; i < valores.length; i++) {
      var preenchidas = valores[i].filter(function (c) { return String(c).trim() !== ""; }).length;
      if (preenchidas > 3) { h = i; break; }
    }
    if (h < 0) return;

    // colunas que ficam (as de login/senha são cortadas aqui, antes de sair)
    var manter = [];
    valores[h].forEach(function (nome, c) {
      var n = String(nome).trim();
      if (!(n && BLOQUEADAS.test(n))) manter.push(c);
    });
    var cabecalho = manter.map(function (c) { return String(valores[h][c]); });
    var dados = valores.slice(h + 1).map(function (linha) {
      return manter.map(function (c) { return String(linha[c] === undefined ? "" : linha[c]); });
    });

    var primeiraLinhaDaAba = h + 2; // número da linha na aba (1 = primeira linha)
    if (dados.length === 0) {
      postar_(url, segredo, { tipo: "lote", planilha: planilha, aba: aba.getName(), cabecalho: cabecalho, primeiraLinha: primeiraLinhaDaAba, linhas: [], primeiro: true });
    }
    for (var inicio = 0; inicio < dados.length; inicio += TAMANHO_LOTE) {
      postar_(url, segredo, {
        tipo: "lote",
        planilha: planilha,
        aba: aba.getName(),
        cabecalho: cabecalho,
        primeiraLinha: primeiraLinhaDaAba + inicio,
        linhas: dados.slice(inicio, inicio + TAMANHO_LOTE),
        primeiro: inicio === 0,
      });
    }
    abasEnviadas.push(aba.getName());
  });

  postar_(url, segredo, { tipo: "fim", planilha: planilha, abas: abasEnviadas });
  console.log("Enviado: " + abasEnviadas.length + " aba(s) para '" + planilha + "'.");
}

function postar_(url, segredo, corpo) {
  var resposta = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    headers: { "x-sync-secret": segredo },
    payload: JSON.stringify(corpo),
    muteHttpExceptions: true,
  });
  var codigo = resposta.getResponseCode();
  if (codigo !== 200) {
    throw new Error("O site respondeu " + codigo + ": " + resposta.getContentText().slice(0, 200));
  }
}

/** Agenda o envio todo dia às 6h (rode uma vez). */
function criarGatilhoDiario() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "enviarPlanilha") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("enviarPlanilha").timeBased().everyDays(1).atHour(6).create();
}
