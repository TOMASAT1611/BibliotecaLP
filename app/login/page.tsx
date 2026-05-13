"use client";

import { Suspense, useEffect, useState } from "react";

import type { ReactElement } from "react";

import { useRouter, useSearchParams } from "next/navigation";

function LoginForm(): ReactElement {
  const router = useRouter();

  const sp = useSearchParams();

  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);

  const [msg, setMsg] = useState<string | null>(null);

  const nextHref =
    (() => {

      const n = sp.get("next");

      return n?.startsWith("/") && !n.startsWith("//") ? n : "/";

    })();

  useEffect(() => {

    void fetch("/api/auth/status", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {

        if (j?.locked === false) router.replace(nextHref);

        else if (j?.locked && j.authenticated) router.replace(nextHref);

      });

  }, [router, nextHref]);

  async function submit(ev: React.FormEvent): Promise<void> {

    ev.preventDefault();

    setBusy(true);

    setMsg(null);

    try {

      const res = await fetch("/api/auth/login", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        credentials: "include",

        body: JSON.stringify({ password }),

      });

      if (!res.ok) {

        const ej = (await res.json().catch(() => ({}))) as { error?: string };

        setMsg(ej.error ?? `Error (${res.status})`);

      } else router.replace(nextHref);

    } catch {

      setMsg("Error de red al iniciar sesión.");

    } finally {

      setBusy(false);

    }

  }

  return (

    <div className="relative z-10 mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-5 py-14 sm:py-20">

      <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-neutral-950/75 p-8 shadow-[0_28px_120px_rgba(0,0,0,0.55)] backdrop-blur-xl">

        <div


          aria-hidden="true"


          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_0%_-20%,rgba(251,191,36,0.08),transparent_50%),radial-gradient(ellipse_at_100%_120%,rgba(56,189,248,0.1),transparent_45%)]"


        />

        <div className="relative space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/90">Feria · Biblioteca</p>

          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Biblioteca LP</h1>

          <p className="text-sm text-neutral-400">Feria · plano del espacio — acceso reservado para el equipo.</p>
        </div>

        <form className="relative mt-10 space-y-4" onSubmit={(e) => void submit(e)}>

          <label className="flex flex-col gap-2">

            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">

              Contraseña

            </span>

            <input

              autoComplete="current-password"

              className="rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-[15px] text-neutral-50 outline-none ring-0 transition placeholder:text-neutral-600 focus:border-amber-400/50 focus:bg-black/55"

              placeholder="••••••••"

              type="password"

              value={password}

              onChange={(e) => setPassword(e.target.value)}

            />

          </label>

          <button

            disabled={busy || !password}

            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-sky-600 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-black/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"

            type="submit"

          >

            Entrar al plano

          </button>

          {msg ? <p className="text-center text-sm text-rose-300">{msg}</p> : null}

        </form>

        <p className="relative mt-10 text-center text-[11px] leading-relaxed text-neutral-600">
          ¿Perdiste la clave? Pedila quien hospeda esta app.

        </p>

      </div>

    </div>

  );


}

export default function LoginPage(): ReactElement {

  return (

    <div className="relative min-h-screen overflow-hidden bg-[#030712] text-neutral-100">

      {/* Fondo cinematográfico sin video pesado: luces típicas de feria sobre noche; podés sustituir por <video muted loop playsInline> en public/ si cargás tu propio loop. */}
      <div


        aria-hidden="true"


        className="pointer-events-none absolute inset-0 opacity-[0.55] blur-sm"


        style={{

          backgroundImage:

            "radial-gradient(ellipse 140% 80% at 20% -10%, rgba(251,146,60,0.35), transparent 55%), radial-gradient(circle at 80% 20%, rgba(56,189,248,0.22), transparent 40%), radial-gradient(circle at 50% 100%, rgba(16,185,129,0.12), transparent 45%)",

        }}


      />

      <div

        aria-hidden="true"

        className="pointer-events-none absolute inset-x-0 top-24 flex justify-around opacity-30"

      >

        {Array.from({ length: 18 }).map((_, i) => (

          <span

            key={i}

            className="h-1.5 w-1.5 rounded-full bg-amber-200/80 shadow-[0_0_12px_rgba(253,230,138,0.9)]"

          />

        ))}

      </div>

      <div


        aria-hidden="true"


        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:48px_48px] opacity-25"


      />

      <Suspense

        fallback={

          <div className="flex min-h-screen items-center justify-center text-neutral-500">Cargando…</div>

        }

      >

        <LoginForm />

      </Suspense>

    </div>

  );


}
