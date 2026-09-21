"use client";

import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// Só http(s) vira link — o texto é digitado pela equipe e não pode
// carregar javascript: nem outro esquema.
const PARTE_URL = /(https?:\/\/\S+)/;
const PONTUACAO_FINAL = /[.,;:!?)\]]+$/;

function encurtar(url: string) {
  try {
    const u = new URL(url);
    const texto = u.host.replace(/^www\./, "") + (u.pathname === "/" ? "" : u.pathname);
    return texto.length > 40 ? texto.slice(0, 39) + "…" : texto;
  } catch {
    return url;
  }
}

/** Texto com os endereços clicáveis, preservando quebras de linha. */
export function LinkedText({ text }: { text: string }) {
  return (
    <>
      {text.split(PARTE_URL).map((parte, i) => {
        if (i % 2 === 0) return parte;
        const sobra = parte.match(PONTUACAO_FINAL)?.[0] ?? "";
        const url = sobra ? parte.slice(0, -sobra.length) : parte;
        return (
          <span key={i}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-700 underline underline-offset-2 dark:text-blue-400"
            >
              {encurtar(url)}
            </a>
            {sobra}
          </span>
        );
      })}
    </>
  );
}

/**
 * Célula de texto do Plano. Parada, mostra o texto como documento (com os
 * links clicáveis); ao clicar vira campo de edição e salva ao sair.
 */
export function EditableCell({
  value,
  canEdit,
  placeholder,
  riscado,
  className,
  onCommit,
}: {
  value: string;
  canEdit: boolean;
  placeholder?: string;
  riscado?: boolean;
  className?: string;
  onCommit: (texto: string) => void;
}) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  const saved = useRef(value);

  const visual = cn("whitespace-pre-wrap break-words text-sm", riscado && "line-through opacity-60", className);

  if (!canEdit) {
    return (
      <div className={visual}>
        <LinkedText text={text} />
      </div>
    );
  }

  if (editing) {
    return (
      <Textarea
        autoFocus
        value={text}
        placeholder={placeholder}
        className={cn("min-h-9 resize-none px-1.5 py-1 text-sm", riscado && "line-through opacity-60", className)}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (text !== saved.current) {
            saved.current = text;
            onCommit(text);
          }
        }}
      />
    );
  }

  return (
    <div
      role="textbox"
      tabIndex={0}
      className={cn(visual, "min-h-9 cursor-text rounded-md px-1.5 py-1 hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none")}
      onClick={(e) => {
        // clicar num link abre o link; o resto da célula entra em edição
        if ((e.target as HTMLElement).closest("a")) return;
        setEditing(true);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") setEditing(true);
      }}
    >
      {text ? <LinkedText text={text} /> : <span className="text-muted-foreground">{placeholder}</span>}
    </div>
  );
}
