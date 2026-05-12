"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[salon-planner]", error.message, error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 bg-[#030712] px-6 py-16 text-neutral-100">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-rose-300/90">
        Error en la app
      </p>
      <h1 className="text-2xl font-semibold text-white">Se cortó el plano (no es una pantalla vacía)</h1>
      <p className="text-sm leading-relaxed text-neutral-400">
        El código dejó de renderizar antes de llegar al tablero. Mirá{" "}
        <strong className="text-neutral-300">las herramientas de desarrollador (F12) → pestaña Console</strong>{" "}
        por si hay un mensaje más largo, o probá reconectar después de revisar tus zonas JSON en «Ajustes».
      </p>
      <pre className="max-h-40 overflow-auto rounded-xl border border-white/10 bg-black/55 p-4 text-[11px] text-rose-200/95">
        {error.message}
      </pre>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-sky-400"
        >
          Intentar de nuevo
        </button>
        <Link
          href="/"
          className="rounded-xl border border-neutral-600 px-4 py-2 text-sm font-semibold text-neutral-200 hover:border-sky-500/50"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
