import { redirect } from "next/navigation";

// Sem painel/resumo separado: abrir o site já cai direto no Planos.
export default function HomePage() {
  redirect("/planos");
}
