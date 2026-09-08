"use client";

import { useEffect, useRef } from "react";
import { HEARTBEAT_INTERVAL_MS, TIME_LOG_SESSION_STORAGE_KEY } from "@/lib/time/session";

// Monta o clock-in ao entrar na área logada, manda heartbeat a cada
// alguns minutos enquanto a aba estiver aberta, e tenta fechar a
// sessão de ponto (best-effort) se a aba for fechada sem logout.
export function HeartbeatPing() {
  const timeLogIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function clockIn() {
      const cached = sessionStorage.getItem(TIME_LOG_SESSION_STORAGE_KEY);
      if (cached) {
        timeLogIdRef.current = cached;
        return;
      }
      const res = await fetch("/api/time/clock-in", { method: "POST" });
      if (!res.ok || cancelled) return;
      const { time_log_id } = await res.json();
      timeLogIdRef.current = time_log_id;
      sessionStorage.setItem(TIME_LOG_SESSION_STORAGE_KEY, time_log_id);
    }

    clockIn();

    const interval = setInterval(() => {
      const id = timeLogIdRef.current;
      if (!id) return;
      fetch("/api/time/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ time_log_id: id }),
      });
    }, HEARTBEAT_INTERVAL_MS);

    function handlePageHide() {
      const id = timeLogIdRef.current;
      if (!id) return;
      const blob = new Blob([JSON.stringify({ time_log_id: id })], { type: "application/json" });
      navigator.sendBeacon("/api/time/heartbeat-close", blob);
    }

    window.addEventListener("pagehide", handlePageHide);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, []);

  return null;
}
