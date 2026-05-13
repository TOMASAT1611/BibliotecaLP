"use client";


import {


  Suspense,

  useEffect,

  useState,

} from "react";

import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {

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




        if (j?.locked === false)


          router.replace(nextHref);



        else if (j?.locked && j.authenticated) router.replace(nextHref);



      });




  }, [router, nextHref]);





  async function submit(ev: React.FormEvent) {


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


        const ej = await res.json().catch(() => ({})) as {

          error?: string;


        };


        setMsg(ej.error ?? `Error (${res.status})`);


      } else {




        router.replace(nextHref);


      }


    } catch {


      setMsg("Error de red al iniciar sesión.");


    } finally {


      setBusy(false);


    }


  }




  return (


    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">




      <h1 className="text-2xl font-semibold text-white">Biblioteca LP</h1>



      <p className="mt-2 text-sm text-neutral-400">


        Contraseña compartida (familia/equipo) para usar el planeador en la web.



      </p>




      <form onSubmit={(e) => void submit(e)} className="mt-8 space-y-4">





        <label className="flex flex-col gap-2 text-neutral-300">



          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">


            Contraseña


          </span>


          <input


            type="password"


            autoComplete="current-password"


            className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-neutral-50 outline-none focus:border-sky-500"


            value={password}


            onChange={(e) => setPassword(e.target.value)}


          />


        </label>



        <button




          disabled={busy || !password}


          type="submit"


          className="w-full rounded-xl bg-sky-600 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-sky-900/30 hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50"


        >




          Entrar




        </button>


        {msg ? <p className="text-center text-sm text-rose-300">{msg}</p> : null}


      </form>


      <p className="mt-12 text-center text-[11px] leading-relaxed text-neutral-600">


        Si olvidás la contraseña, pedila al equipo que la configuró en el servidor. La verificación por email


        requiere un proveedor de correo; se puede agregar en otro paso.



      </p>


    </div>


  );


}

export default function LoginPage(): React.ReactElement {


  return (


    <Suspense




      fallback={


        <div className="flex min-h-screen items-center justify-center text-neutral-500">…</div>


      }




    >




      <LoginForm />




    </Suspense>


  );


}
