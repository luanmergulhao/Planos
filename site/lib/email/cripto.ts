// Cifra a senha de app das caixas de e-mail antes de ir pro banco
// (tabela plano_caixas_email). AES-256-GCM, chave derivada de
// EMAIL_CRYPTO_KEY — ou, se ela não existir, da service role do Supabase,
// que já é o segredo mestre do banco (quem tem ela lê tudo de qualquer
// jeito). Trocar a chave invalida as senhas salvas: é só reconectar.

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function chave() {
  const segredo = process.env.EMAIL_CRYPTO_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!segredo) throw new Error("Sem chave pra cifrar a senha: configure EMAIL_CRYPTO_KEY.");
  return createHash("sha256").update(`caixas-email:${segredo}`).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), dados].map((b) => b.toString("base64")).join(".");
}

export function decifrar(cifrado: string): string {
  const [iv, tag, dados] = cifrado.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", chave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(dados), decipher.final()]).toString("utf8");
}
