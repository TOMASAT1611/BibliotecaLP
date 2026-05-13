"use client";

import { FloorPlan } from "@/components/FloorPlan";
import {
  centroidPoly,
  clampStallCenter,
  snapStallCenterXY,
} from "@/lib/geo";
import { migrateAppState } from "@/lib/migrate";
import type {
  AppState,
  Participant,
  PlanZone,
  Pt,

  Stall,
  StallCategory,
  Venue,
} from "@/lib/types";
import { CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/types";
import { toCanvas, toPng } from "html-to-image";
import type { ChangeEvent, ReactNode } from "react";
import { flushSync } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

function fileSlug(s: string, max = 40): string {
  const t = s
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-_.áéíóúüñÁÉÍÓÚÜÑ]+/g, "")
    .replace(/^-+|-+$/g, "");

  return t.slice(0, max) || "zona";
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();

  return `tmp_${Math.random().toString(36).slice(2, 10)}`;
}

function isPlanZoneJson(item: unknown): item is PlanZone {
  if (!item || typeof item !== "object") return false;
  const o = item as Record<string, unknown>;

  if (typeof o.id !== "string" || typeof o.name !== "string") return false;

  if (typeof o.fill !== "string" || typeof o.stroke !== "string") return false;

  if (!Array.isArray(o.polygonM) || o.polygonM.length < 3) return false;

  if (
    !o.polygonM.every(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof (p as Record<string, unknown>).x === "number" &&
        typeof (p as Record<string, unknown>).y === "number",
    )
  )
    return false;

  if (o.hint !== undefined && typeof o.hint !== "string") return false;

  return true;
}

function parseZonesJson(txt: string): PlanZone[] | null {
  try {
    const parsed = JSON.parse(txt) as unknown;
    if (!Array.isArray(parsed) || !parsed.every(isPlanZoneJson)) return null;

    return parsed;
  } catch {
    return null;
  }
}


const inputClass =
  "w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-50 outline-none transition focus:border-sky-400/80 focus:ring focus:ring-sky-500/25";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-2 text-neutral-300">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function StallInspector({
  stall,

  venue,

  participants,
  onPatch,
  onDelete,
}: {
  stall: Stall;
  venue: Venue;
  participants: Participant[];
  onPatch: (partial: Partial<Stall>) => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800/85 bg-neutral-900/65 p-4 shadow-xl shadow-black/40 backdrop-blur">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-neutral-400">
            Puesto seleccionado
          </p>
          <p className="text-2xl font-semibold text-neutral-50">{stall.label}</p>
        </div>
        <span
          className="rounded-full px-3 py-1 text-[11px] font-semibold text-neutral-950"
          style={{
            backgroundColor: CATEGORY_COLOR[stall.category],
            boxShadow: "0 0 0 1px rgba(15,118,210,0.4)",
          }}
        >
          {CATEGORY_LABEL[stall.category]}
        </span>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nombre visible en cartel">
          <input
            className={inputClass}
            value={stall.label}
            onChange={(e) => onPatch({ label: e.target.value })}
          />
        </Field>

        <Field label="Zona física">
          <select
            className={inputClass}
            value={stall.zoneId}
            onChange={(e) => onPatch({ zoneId: e.target.value })}
          >
            {venue.zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Categoría táctica">
          <select
            className={inputClass}
            value={stall.category}
            onChange={(e) =>
              onPatch({
                category: e.target.value as StallCategory,
              })
            }
          >
            {(Object.keys(CATEGORY_LABEL) as StallCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABEL[cat]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Representante registrado">
          <select
            className={inputClass}
            value={stall.participantId ?? ""}
            onChange={(e) =>
              onPatch({
                participantId: e.target.value ? e.target.value : null,
              })
            }
          >
            <option value="">Espacio disponible</option>
            {participants.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {!p.confirmed ? " · sin confirmar" : " · confirmado"}
              </option>
            ))}
          </select>
        </Field>

        <div className="sm:col-span-2 rounded-lg border border-neutral-800/70 bg-neutral-950/50 px-3 py-2 text-[11px] leading-snug text-neutral-400">
          <strong className="text-neutral-300">Ancho</strong> y <strong className="text-neutral-300">largo</strong> son
          el rectángulo en metros antes de aplicar la rotación (en 0°, el ancho sigue la horizontal del plano y el
          largo la vertical). El cartel en el lienzo es &quot;
          <span className="font-mono text-sky-300/95">{stall.label}</span>&quot;. Si elegís &quot;
          Representante&quot;, también se muestra el nombre de esa persona cuando exista en Personas.
        </div>

        <Field label="Orientación (−360…360)">
          <input
            type="number"
            step={5}
            className={inputClass}
            value={stall.rotationDeg}
            onChange={(e) => {
              const v = Number.parseFloat(e.target.value);
              if (Number.isFinite(v)) onPatch({ rotationDeg: v });
            }}
          />
        </Field>

        <Field label="Ancho (m) · lado menor si es mesa típica">
          <input
            type="number"
            step={0.05}
            min={0.45}
            className={inputClass}
            value={stall.widthM}
            onChange={(e) => {
              const v = Number.parseFloat(e.target.value);
              if (Number.isFinite(v)) onPatch({ widthM: Math.max(0.45, v) });
            }}
          />
        </Field>

        <Field label="Largo (m) · fondo de la mesa">
          <input
            type="number"
            step={0.05}
            min={0.35}
            className={inputClass}
            value={stall.depthM}
            onChange={(e) => {
              const v = Number.parseFloat(e.target.value);
              if (Number.isFinite(v)) onPatch({ depthM: Math.max(0.35, v) });
            }}
          />
        </Field>
      </div>

      <footer className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          className="rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-100 hover:bg-neutral-700"
          onClick={() =>
            onPatch({
              rotationDeg: (((stall.rotationDeg || 0) + 90) % 360 + 360) % 360,
            })
          }
        >
          +90° rápido
        </button>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg border border-rose-500/65 px-4 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-900/55"
        >
          Sacar esta mesa del plano
        </button>
      </footer>
    </div>
  );
}

function Splash({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),transparent_62%)] px-10 text-neutral-400">
      <p className="max-w-md text-center leading-relaxed text-neutral-200">{children}</p>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-neutral-900/70 px-4 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{label}</p>
      <p className="text-lg font-semibold text-neutral-50">{value}</p>
    </div>
  );
}

export default function EventDashboard() {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [tab, setTab] = useState<"plano" | "personas" | "resumen" | "tecnico">("plano");
  const [selectedStallId, setSelectedStallId] = useState<string | null>(null);

  const [activeZoneId, setActiveZoneId] = useState<string>("pasto");

  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [zonesJsonText, setZonesJsonText] = useState("");

  const zonesEditorReady = useRef(false);

  const [polygonEditActive, setPolygonEditActive] = useState(false);

  const [persistMsg, setPersistMsg] = useState<string | null>(null);

  const [persistBusy, setPersistBusy] = useState(false);

  const [exportVisualBusy, setExportVisualBusy] = useState(false);

  type ExportFmt = "png" | "svg" | "json";

  type ExportScope = "current" | "all";

  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const [exportFmt, setExportFmt] = useState<ExportFmt>("png");

  const [exportScope, setExportScope] = useState<ExportScope>("current");

  const [authGate, setAuthGate] = useState<null | { locked: boolean }>(null);

  const planExportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {


    void fetch("/api/auth/status", { credentials: "include" })


      .then((r) => (r.ok ? r.json() : null))


      .then((json: unknown) => {


        const o = json && typeof json === "object" ? (json as { locked?: unknown }) : null;


        const locked = o && typeof o.locked === "boolean" ? o.locked : false;


        setAuthGate({ locked });


      });


  }, []);


  useEffect(() => {


    if (!exportDialogOpen) return;


    function esc(ev: KeyboardEvent) {


      if (ev.key === "Escape") setExportDialogOpen(false);


    }


    window.addEventListener("keydown", esc);


    return () => window.removeEventListener("keydown", esc);


  }, [exportDialogOpen]);


  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/state", { cache: "no-store", credentials: "include" });
        if (!res.ok)
          throw new Error("No pudimos leer `/api/state`. ¿Corre `npm run dev` en esta carpeta?");

        const json = (await res.json()) as AppState;

        const safe = migrateAppState(json);

        setState(safe);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Error leyendo el guardado.");
      } finally {
        setMounted(true);
      }
    })();
  }, []);

  /** guardado automático (single-user) **/
  useEffect(() => {
    if (!mounted || !state) return;

    const handle = window.setTimeout(() => {
      void fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(state),
      }).catch(() => {
        console.warn("[salon-planner]", "persistencia tardía falló una vez.");
      });
    }, 620);

    return () => window.clearTimeout(handle);
  }, [mounted, state]);

  /** Zona destacada cuando agregamos una mesa nueva. */
  useEffect(() => {
    if (!state) return;

    const ok = state.venue.zones.some((z) => z.id === activeZoneId);

    const fallback = state.venue.zones[0]?.id ?? "pasto";

    if (!ok) setActiveZoneId(fallback);
  }, [state, activeZoneId]);

  useEffect(() => {
    if (tab !== "tecnico") zonesEditorReady.current = false;
  }, [tab]);

  useEffect(() => {
    if (tab !== "tecnico") return;

    if (!state) return;

    if (!zonesEditorReady.current) {
      setZonesJsonText(JSON.stringify(state.venue.zones, null, 2));

      zonesEditorReady.current = true;

    }


  }, [tab, state]);

  /** ---- derivados ----- **/
  const assignedPeople = useMemo(() => {
    if (!state) return new Set<string>();

    return new Set(
      state.stalls.map((s) => s.participantId).filter(Boolean) as string[],
    );
  }, [state]);

  const unassignedParticipants = useMemo(() => {
    if (!state) return [];
    return state.participants.filter((p) => !assignedPeople.has(p.id));
  }, [assignedPeople, state]);

  const selectedStall = useMemo(
    () =>
      state?.stalls.find((stall) => stall.id === selectedStallId),
    [selectedStallId, state?.stalls],
  );

  /** --- mutadores ---------- **/
  function replaceParticipants(nextPeople: Participant[]) {
    setState((prev) => (prev ? { ...prev, participants: nextPeople } : prev));
  }

  function mutateStalls(mutator: (list: Stall[]) => Stall[]): void {
    setState((prev) => (!prev ? prev : { ...prev, stalls: mutator(prev.stalls) }));
  }

  function upsertStall(nextStall: Stall) {
    mutateStalls((list) =>
      list.map((stall) => {
        if (
          stall.id !== nextStall.id &&
          nextStall.participantId &&
          stall.participantId === nextStall.participantId
        )
          return { ...stall, participantId: null };

        return stall.id === nextStall.id ? nextStall : stall;
      }),
    );
  }


  function patchZonePolygon(zoneId: string, polygonM: Pt[]) {


    setState((prev) => {


      if (!prev) return prev;


      const zones = prev.venue.zones.map((zoneItem) =>
        zoneItem.id === zoneId ?


          { ...zoneItem, polygonM: polygonM.map((punto) => ({ ...punto })) }


        : zoneItem,


      );


      const zHit = zones.find((candidato) => candidato.id === zoneId);


      const polySafe =


        zHit && zHit.polygonM.length >= 3 ? zHit.polygonM : ([] as Pt[]);


      const stallsNext =
        polySafe.length < 3 ?
          prev.stalls

        : prev.stalls.map((st) => {
            if (st.zoneId !== zoneId) return st;

            const clamped = clampStallCenter(
              { x: st.xm, y: st.ym },
              st.widthM,
              st.depthM,
              st.rotationDeg,
              polySafe,
            );

            const snapped = snapStallCenterXY(
              clamped.x,
              clamped.y,
              st.widthM,
              st.depthM,
              st.rotationDeg,
              polySafe,
              prev.venue.snapGridM,
            );

            return { ...st, xm: snapped.x, ym: snapped.y };
          });


      return migrateAppState({
        ...prev,
        venue: { ...prev.venue, zones },


        stalls: stallsNext,


      });


    });


  }


  function patchSelectedStall(partial: Partial<Stall>) {
    if (!selectedStall || !state) return;

    let merged: Stall = { ...selectedStall, ...partial };

    const zoneId =
      typeof merged.zoneId === "string" &&
      state.venue.zones.some((z) => z.id === merged.zoneId) ?
        merged.zoneId


      : selectedStall.zoneId;

    const zone = state.venue.zones.find((z) => z.id === zoneId) ?? state.venue.zones[0]!;

    if (partial.zoneId && partial.zoneId !== selectedStall.zoneId) {
      const c = centroidPoly(zone.polygonM);

      merged = { ...merged, zoneId, xm: c.x, ym: c.y };

    }

    merged.widthM =
      merged.widthM > 0 ? merged.widthM : state.venue.stallWidthDefaultM;

    merged.depthM =
      merged.depthM > 0 ? merged.depthM : state.venue.stallDepthDefaultM;

    const centered = clampStallCenter(
      { x: merged.xm, y: merged.ym },

      merged.widthM,

      merged.depthM,

      merged.rotationDeg,

      zone.polygonM,

    );

    const snapped = snapStallCenterXY(
      centered.x,

      centered.y,

      merged.widthM,

      merged.depthM,

      merged.rotationDeg,

      zone.polygonM,

      state.venue.snapGridM,

    );

    merged = { ...merged, xm: snapped.x, ym: snapped.y };

    upsertStall(merged);

  }

  function deleteSelectedStall() {
    if (!selectedStall) return;
    mutateStalls((list) => list.filter((s) => s.id !== selectedStall.id));
    setSelectedStallId(null);
  }

  function addStall(): void {
    if (!state) return;

    const zid =
      state.venue.zones.some((z) => z.id === activeZoneId) ?
        activeZoneId


      : (state.venue.zones[0]?.id ?? "pasto");

    const zone = state.venue.zones.find((z) => z.id === zid) ?? state.venue.zones[0]!;

    const depth = Math.max(state.venue.stallDepthDefaultM, 0.35);

    const widthM = state.venue.stallWidthDefaultM;

    const rot = 0;

    const guess = centroidPoly(zone.polygonM);

    const focused = clampStallCenter(
      { x: guess.x, y: guess.y },

      widthM,

      depth,

      rot,

      zone.polygonM,

    );

    const snapped = snapStallCenterXY(
      focused.x,

      focused.y,

      widthM,

      depth,

      rot,

      zone.polygonM,

      state.venue.snapGridM,

    );

    const stall: Stall = {
      id: newId(),

      zoneId: zone.id,

      label: `Mesa ${state.stalls.length + 1}`,

      category: "varios",

      xm: snapped.x,

      ym: snapped.y,

      rotationDeg: rot,

      widthM,

      depthM: depth,

      participantId: null,

    };

    mutateStalls((list) => [...list, stall]);

    setSelectedStallId(stall.id);

  }

  const runDeleteRef = useRef(deleteSelectedStall);
  const runAddRef = useRef(addStall);
  runDeleteRef.current = deleteSelectedStall;
  runAddRef.current = addStall;

  useEffect(() => {
    function onHotkey(ev: KeyboardEvent) {
      if (tab !== "plano") return;

      const tgt = ev.target as HTMLElement;
      if (tgt.closest("input, textarea, select, button, [contenteditable='true']")) return;

      if (ev.key === "Delete" || ev.key === "Backspace") {
        if (!selectedStallId) return;
        ev.preventDefault();
        runDeleteRef.current();
        return;
      }

      const wantsAdd =
        ev.key === "+" || ev.code === "NumpadAdd" || (ev.shiftKey && ev.code === "Equal");

      if (wantsAdd && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        runAddRef.current();
      }
    }

    window.addEventListener("keydown", onHotkey);
    return () => window.removeEventListener("keydown", onHotkey);
  }, [tab, selectedStallId]);

  function addParticipant(): void {
    if (!state) return;

    const next: Participant = {
      id: newId(),
      name: `Persona ${state.participants.length + 1}`,
      phone: null,
      whatBrings: null,
      confirmed: false,
    };

    replaceParticipants([...state.participants, next]);
  }

  function patchParticipant(id: string, partial: Partial<Participant>) {
    if (!state) return;

    replaceParticipants(
      state.participants.map((p) =>
        p.id === id ?
          ({
            ...p,
            ...partial,
          })
        : p),
    );
  }

  function removeParticipant(id: string) {
    if (!state) return;

    mutateStalls((list) =>
      list.map((s) => (s.participantId === id ? { ...s, participantId: null } : s)),
    );

    replaceParticipants(state.participants.filter((p) => p.id !== id));
  }

  async function importParticipantsFromWord(ev: ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";

    if (!file || !state) return;

    setImportMsg("Leyendo Word…");

    const fd = new FormData();

    fd.append("file", file);

    try {
      const res = await fetch("/api/import-word", { method: "POST", credentials: "include", body: fd });

      const data = (await res.json()) as {


        participants?: { name: string; phone: string | null; whatBrings: string | null }[];


        error?: string;


        hint?: string;

      };


      if (!res.ok || !data.participants?.length) {
        const detail = data.error ?? "No entraron filas del Word.";
        const h = data.hint ? ` ${data.hint}` : "";

        setImportMsg(`${detail}${h}`);
        return;
      }

      const existing = new Set(
        state.participants.map((p) => p.name.trim().toLowerCase()).filter(Boolean),
      );


      let skipped = 0;

      const toAdd: Participant[] = [];

      for (const row of data.participants) {


        const key = row.name.trim().toLowerCase();


        if (!key || existing.has(key)) {
          skipped += 1;


          continue;


        }

        existing.add(key);

        toAdd.push({
          id: newId(),
          name: row.name.trim(),
          phone: row.phone,
          whatBrings: row.whatBrings,
          confirmed: false,
        });
      }

      if (!toAdd.length) {
        setImportMsg(`Nadie nuevo: todas las líneas repetían nombre o vinieron vacías.`);

        return;
      }

      setState((prev) =>
        prev ? { ...prev, participants: [...prev.participants, ...toAdd] } : prev,
      );

      setImportMsg(`Importadas ${toAdd.length} personas.${skipped ? ` Omitidas por duplicado: ${skipped}.` : ""}`);
    } catch {


      setImportMsg("No se pudo leer el archivo (¿red cortada?).");


    }


  }



  async function persistNow(): Promise<void> {


    if (!state) return;


    setPersistBusy(true);


    setPersistMsg(null);


    try {


      const res = await fetch("/api/state", {


        method: "PUT",


        headers: { "Content-Type": "application/json" },


        credentials: "include",


        body: JSON.stringify(state),


      });


      const rawText = await res.text();


      if (!res.ok) {


        let hint = "";

        try {

          const ej = JSON.parse(rawText) as { error?: string; detail?: string };

          hint = ej.detail?.trim() ?? ej.error?.trim() ?? "";

        } catch {

          hint = rawText.trim().slice(0, 200);

        }

        const suffix = hint ? ` · ${hint.slice(0, 280)}` : "";

        setPersistMsg(`No se pudo guardar (HTTP ${res.status})${suffix}`);

        return;

      }



      let bodyJson: unknown;

      try {

        bodyJson = JSON.parse(rawText);

      } catch {

        setPersistMsg("Respuesta rara del servidor al guardar (no era JSON).");

        return;

      }


      const merged = migrateAppState(bodyJson as Partial<AppState>);


      setState(merged);



      zonesEditorReady.current = false;



      setPersistMsg(



        `Guardado OK · ${new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`,



      );


    } catch {



      setPersistMsg("Error de red al guardar.");



    } finally {


      setPersistBusy(false);



    }



  }



  function exportPlanJson(): void {


    if (!state) return;


    const bundle = {


      format: "BibliotecaLP-plan",

      version: 1,

      exportedAt: new Date().toISOString(),



      state,


    };



    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });



    const url = URL.createObjectURL(blob);



    const anchor = document.createElement("a");



    anchor.href = url;


    anchor.download = `biblioteca-lp-plano-${new Date().toISOString().slice(0, 10)}.json`;


    anchor.click();


    URL.revokeObjectURL(url);



    setPersistMsg("JSON técnico descargado (sirve sólo para «Importar JSON» aquí).");


  }




  async function logout(): Promise<void> {


    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });


    window.location.href = "/login";


  }






  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });
  }

  async function downloadPngCapture(
    root: HTMLDivElement,
    zoneLabel: string,
    stemExtra: string,
  ): Promise<void> {
    const dataUrl = await toPng(root, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: "#030712",
    });
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    const day = new Date().toISOString().slice(0, 10);
    anchor.download = `biblioteca-lp-${fileSlug(zoneLabel)}-${day}${stemExtra}.png`;
    anchor.click();
  }

  function downloadSvgCapture(root: HTMLDivElement, zoneLabel: string, stemExtra: string): void {
    const svg = root.querySelector("svg");
    if (!svg) throw new Error("sin-svg");
    const xml = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n`, xml], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement("a");
      anchor.href = url;
      const day = new Date().toISOString().slice(0, 10);
      anchor.download = `biblioteca-lp-${fileSlug(zoneLabel)}-${day}${stemExtra}.svg`;
      anchor.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function downloadStackedZonesPng(zones: PlanZone[]): Promise<void> {
    const pad = 22;

    const gap = 26;

    const captures: HTMLCanvasElement[] = [];

    for (let zi = 0; zi < zones.length; zi += 1) {
      const zone = zones[zi];

      flushSync(() => {


        setActiveZoneId(zone.id);


      });


      await delay(zi === 0 ? 300 : 380);

      const root = planExportRef.current;


      if (!root?.querySelector("svg")) throw new Error(`sin-captura-${zone.id}`);


      captures.push(
        await toCanvas(root, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: "#030712",
        }),
      );
    }



    const maxW = Math.max(...captures.map((c) => c.width));


    const totalH =
      captures.reduce((acc, c) => acc + c.height, 0) + gap * (captures.length - 1) + pad * 2;


    const merged = document.createElement("canvas");

    merged.width = maxW + pad * 2;

    merged.height = totalH;

    const ctx = merged.getContext("2d");
    if (!ctx) throw new Error("sin-2d");


    ctx.fillStyle = "#030712";

    ctx.fillRect(0, 0, merged.width, merged.height);

    let y = pad;



    for (const c of captures) {


      ctx.drawImage(c, pad + (maxW - c.width) / 2, y);

      y += c.height + gap;


    }



    const dataUrl = merged.toDataURL("image/png");


    const anchor = document.createElement("a");


    anchor.href = dataUrl;


    const day = new Date().toISOString().slice(0, 10);


    anchor.download = `biblioteca-lp-plano-completo-${day}.png`;

    anchor.click();


  }



  async function runVisualExport(mode: ExportFmt, scope: ExportScope): Promise<void> {
    if (!state || (mode !== "png" && mode !== "svg")) return;
    const snapshotTab = tab;
    const snapshotZone = activeZoneId;
    flushSync(() => {


      setTab("plano");


    });



    await delay(72);



    try {
      const zones: PlanZone[] =


        scope === "all"
          ? [...state.venue.zones]
          : (() => {


              const picked =
                state.venue.zones.find((z) => z.id === activeZoneId) ?? state.venue.zones[0];

              return picked ? [picked] : [];

            })();



      if (!zones.length) {


        setPersistMsg("No hay zonas para exportar.");



        return;


      }






      setExportVisualBusy(true);

      setPersistMsg(null);



      if (mode === "png") {



        try {



          if (zones.length === 1) {


            const zone = zones[0]!;





            flushSync(() => {


              setActiveZoneId(zone.id);


            });





            await delay(280);



            const root = planExportRef.current;





            if (!root?.querySelector("svg")) {


              setPersistMsg(`La zona "${zone.name}" no se pudo capturar.`);



              return;



            }






            await downloadPngCapture(root, zone.name, "");

            setPersistMsg("PNG listo.");


          } else {



            await downloadStackedZonesPng(zones);

            setPersistMsg("PNG completo descargado: todas las zonas en una sola imagen (apiladas).");


          }



        } catch {



          setPersistMsg("Algo falló al armar la imagen del plano.");


        }



      } else {



        /** SVG sigue uno por zona (formato técnico). **/

        let stopped = false;

        for (let zi = 0; zi < zones.length; zi += 1) {



          const zone = zones[zi];



          flushSync(() => {


            setActiveZoneId(zone.id);


          });





          await delay(zi === 0 && scope === "current" ? 280 : 360);



          const root = planExportRef.current;



          if (!root?.querySelector("svg")) {


            setPersistMsg(`La zona "${zone.name}" no se pudo capturar.`);




            stopped = true;



            break;


          }






          const extra = zones.length > 1 ? `-${String(zi + 1)}` : "";



          downloadSvgCapture(root, zone.name, extra);



          await delay(160);


        }






        if (!stopped)


          setPersistMsg(zones.length > 1 ? `${zones.length} archivos SVG (uno por zona).` : "SVG listo.");

      }

    } catch {


      setPersistMsg("Algo falló al exportar.");


    } finally {


      flushSync(() => {


        setActiveZoneId(snapshotZone);


      });





      flushSync(() => {


        setTab(snapshotTab);


      });





      setExportVisualBusy(false);


    }


  }

  async function handleExportConfirm(): Promise<void> {
    if (!state) return;
    try {
      if (exportFmt === "json") {
        exportPlanJson();
        setExportDialogOpen(false);
        return;
      }
      await runVisualExport(exportFmt, exportScope);
      setExportDialogOpen(false);
    } catch {
      setExportDialogOpen(false);
    }
  }
  async function importPlanJsonFile(ev: ChangeEvent<HTMLInputElement>): Promise<void> {


    const file = ev.target.files?.[0];



    ev.target.value = "";



    if (!file) return;


    try {


      const txt = await file.text();


      const parsed = JSON.parse(txt) as unknown;



      const rec =



        parsed && typeof parsed === "object" && parsed !== null ?
          (parsed as Record<string, unknown>)



        : null;



      const inner =



        rec && "state" in rec && typeof rec.state === "object" && rec.state !== null ?
          rec.state



        : parsed;



      const next = migrateAppState(inner as Partial<AppState>);



      setState(next);



      zonesEditorReady.current = false;



      setPersistMsg(



        "Plano cargado desde el archivo. Si usás servidor o Neon, tocá «Guardar ahora» para fijarlo.",



      );

    } catch {



      setPersistMsg("El archivo no es un JSON de plano válido.");



    }



  }



  const confirmedCount = state ? state.participants.filter((p) => p.confirmed).length : 0;

  if (!mounted || !state)
    return <Splash>{loadError ?? "Cargando medidas locales…"}</Splash>;

  return (
    <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col gap-8 px-4 py-8 sm:px-8">
      <header className="flex flex-col gap-4 border-b border-white/5 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">{state.venue.name}</h1>
        </div>

        <div className="flex min-w-[12rem] flex-col items-stretch gap-3 md:items-end">
          <div className="flex flex-wrap justify-end gap-2 text-xs text-neutral-300">
            <StatPill label="Mesas" value={`#${state.stalls.length}`} />
            <StatPill label="Personas" value={`#${state.participants.length}`} />
            <StatPill
              label="Confirmaron"
              value={`${confirmedCount}/${Math.max(state.participants.length, 1)}`}
            />
          </div>
          <div className="flex max-w-xl flex-wrap justify-end gap-2">
            {authGate?.locked ? (
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/18"
              >
                Salir
              </button>
            ) : null}
            <button
              type="button"
              disabled={persistBusy}
              onClick={() => void persistNow()}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-neutral-950 shadow-md shadow-emerald-900/30 hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-65"
            >
              Guardar ahora
            </button>
            <button
              type="button"
              disabled={exportVisualBusy}
              onClick={() => setExportDialogOpen(true)}
              className="rounded-xl border border-sky-500/45 bg-sky-500/10 px-4 py-2 text-xs font-semibold text-sky-100 hover:bg-sky-500/18 disabled:cursor-wait disabled:opacity-65"
            >
              Exportar…
            </button>
            <label className="cursor-pointer rounded-xl border border-neutral-600 bg-neutral-900/55 px-4 py-2 text-xs font-semibold text-neutral-100 hover:bg-neutral-800/65">
              Importar archivo
              <input
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => void importPlanJsonFile(e)}
              />
            </label>
          </div>
          {persistMsg ?
            (<p className="max-w-[22rem] text-right text-[11px] leading-snug text-neutral-400">{persistMsg}</p>)
          : null}
        </div>
      </header>

      {exportDialogOpen ? (
        <div
          aria-labelledby="exportar-titulo"
          aria-modal="true"
          className="fixed inset-0 z-50 flex cursor-default items-center justify-center bg-black/65 px-4 py-8 backdrop-blur-[3px]"
          role="dialog"
          onClick={() => {
            if (!exportVisualBusy) setExportDialogOpen(false);
          }}
        >
          <div
            role="presentation"
            className="w-full max-w-md rounded-2xl border border-white/14 bg-neutral-950/94 p-6 shadow-[0_28px_80px_rgba(0,0,0,0.55)]"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="exportar-titulo" className="text-lg font-semibold text-neutral-50">
              Exportar
            </h2>
            <p className="mt-2 text-[13px] leading-snug text-neutral-400">
              Elegí el formato.
              <span className="block pt-1 text-neutral-500">
                PNG y SVG salen del plano interactivo (por un segundo te lleva ahí). Si elegís{" "}
                <span className="text-neutral-300">todas las zonas en PNG</span>, una sola imagen con todo apilado.
              </span>
            </p>
            <div className="mt-6 space-y-5">
              <fieldset className="space-y-3 text-sm">
                <legend className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                  ¿En qué formato?
                </legend>
                <label className="flex cursor-pointer items-center gap-2 text-neutral-200">
                  <input
                    checked={exportFmt === "png"}
                    className="h-4 w-4 border-neutral-600 bg-neutral-900 text-sky-500"
                    name="export-fmt"
                    onChange={() => setExportFmt("png")}
                    type="radio"
                  />
                  PNG · imagen (WhatsApp, mail…)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-neutral-200">
                  <input
                    checked={exportFmt === "svg"}
                    className="h-4 w-4 border-neutral-600 bg-neutral-900 text-sky-500"
                    name="export-fmt"
                    onChange={() => setExportFmt("svg")}
                    type="radio"
                  />
                  SVG · dibujo vectorial
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-neutral-200">
                  <input
                    checked={exportFmt === "json"}
                    className="h-4 w-4 border-neutral-600 bg-neutral-900 text-sky-500"
                    name="export-fmt"
                    onChange={() => setExportFmt("json")}
                    type="radio"
                  />
                  Archivo técnico (para importar después en esta página)
                </label>
              </fieldset>

              {exportFmt !== "json" ? (
                <fieldset className="space-y-3 text-sm">
                  <legend className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
                    ¿Qué zonas?
                  </legend>
                  <label className="flex cursor-pointer gap-3 text-neutral-200">
                    <input
                      checked={exportScope === "current"}
                      className="mt-0.5 h-4 w-4 shrink-0 border-neutral-600 bg-neutral-900 text-sky-500"
                      name="export-scope"
                      onChange={() => setExportScope("current")}
                      type="radio"
                    />
                    <span>
                      Solo «{state.venue.zones.find((z) => z.id === activeZoneId)?.name ?? "?"}»
                    </span>
                  </label>
                  <label className="flex cursor-pointer gap-3 text-neutral-200">
                    <input
                      checked={exportScope === "all"}
                      className="mt-0.5 h-4 w-4 shrink-0 border-neutral-600 bg-neutral-900 text-sky-500"
                      name="export-scope"
                      onChange={() => setExportScope("all")}
                      type="radio"
                    />
                    <span>
                      Todas las zonas ({state.venue.zones.length}) — en{" "}

                      <strong className="font-medium text-neutral-200">un solo PNG</strong> apiladas verticalmente (sin varias descargas).
                    </span>
                  </label>
                </fieldset>
              ) : (
                <p className="rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-[13px] text-neutral-400">
                  El JSON <span className="text-neutral-200">siempre incluye todas las zonas, mesas y personas</span>.
                </p>
              )}
            </div>

            <div className="mt-8 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-xl border border-white/14 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-white/[0.06]"
                disabled={exportVisualBusy}
                type="button"
                onClick={() => {
                  setExportDialogOpen(false);
                }}
              >
                Cancelar
              </button>
              <button
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-sky-500 disabled:cursor-wait disabled:opacity-50"
                disabled={exportVisualBusy}
                type="button"
                onClick={() => void handleExportConfirm()}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="flex flex-wrap gap-2 text-sm">
        {(
          [
            ["plano", "Plano interactivo"],
            ["personas", "Personas"],
            ["resumen", "Reportes"],
            ["tecnico", "Ajustes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-4 py-2 font-semibold transition ${
              tab === id ?
                "bg-sky-500/25 text-sky-100 ring-1 ring-sky-400/40"
              : "bg-neutral-900/60 text-neutral-400 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "plano" && (
        <div className="space-y-3">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.9fr)]">
          <FloorPlan
            captureRef={planExportRef}
            venue={state.venue}
            stalls={state.stalls}
            participants={state.participants}
            activeZoneId={activeZoneId}
            onZoneChange={setActiveZoneId}
            selectedStallId={selectedStallId}
            onSelectStall={setSelectedStallId}
            onUpsertStall={upsertStall}
            polygonEditActive={polygonEditActive}
            onPolygonEditActiveChange={setPolygonEditActive}
            onZonePolygonChange={patchZonePolygon}
          />

          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => void addStall()}
              disabled={polygonEditActive}
              title={
                polygonEditActive ?
                  "Sacá modo «editar contorno» antes de crear mesas nuevas."
                : undefined
              }

              className="rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-neutral-950 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-45"

            >
              + Nueva mesa ({state.venue.stallWidthDefaultM.toFixed(1)} × {state.venue.stallDepthDefaultM.toFixed(1)} m por defecto)


            </button>

            {selectedStall ?
              <StallInspector
                stall={selectedStall}
                venue={state.venue}
                participants={state.participants}
                onPatch={patchSelectedStall}
                onDelete={deleteSelectedStall}
              />

            : (
              <div className="rounded-2xl border border-dashed border-neutral-700/90 p-6 text-sm text-neutral-400">
                Elegí un bloque de mesa en el plano (zona destacada arriba) o creá una nueva desde el
                botón.
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {tab === "personas" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold text-white">Base de personas + qué llevan</h2>
              <p className="text-sm text-neutral-400">
                Esta es tu “lista de trabajo” paralela al plano físico — podés cargar mails, whatsapp,
                recordatorios, etcétera.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void addParticipant()}
              className="rounded-xl border border-sky-400/40 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-100 hover:bg-sky-500/20"
            >
              + Persona
            </button>

            <label className="cursor-pointer rounded-xl border border-neutral-600 bg-neutral-900/55 px-4 py-2 text-sm font-semibold text-neutral-100 hover:bg-neutral-800/65">
              Importar desde Word (.docx)
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(e) => void importParticipantsFromWord(e)}
              />
            </label>
          </div>

          {importMsg ?
            (
              <p className="rounded-xl border border-neutral-700/80 bg-neutral-900/55 px-4 py-3 text-sm text-neutral-300">
                {importMsg}
              </p>
            )
          : null}

          <p className="text-xs text-neutral-500">
            Docx (.docx): tabla con <strong>nº de puesto · titular del puesto · nombre del puesto</strong> (tabulador
            entre columnas). Se guarda el titular en &quot;Nombre&quot; y el nombre del puesto en la columna de al
            lado; ahí después sumás qué trae y el contacto cuando quieras. También vale una persona por línea o{" "}
            <strong>nombre · teléfono · qué trae</strong>.
          </p>

          <div className="overflow-x-auto rounded-2xl border border-neutral-800 bg-neutral-950/40">
            <table className="min-w-full divide-y divide-neutral-800 text-sm">
              <thead className="bg-neutral-900/70 text-left text-xs uppercase tracking-wide text-neutral-400">
                <tr>
                  <th className="px-4 py-3">Titular del puesto</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Nombre del puesto · qué trae</th>
                  <th className="px-4 py-3">Confirmó</th>
                  <th className="px-4 py-3">Mesa</th>
                  <th className="px-4 py-3 text-right text-neutral-600">Acción</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-neutral-900 text-neutral-200">
                {state.participants.map((person) => {
                  const stallForPerson = state.stalls.find((s) => s.participantId === person.id);

                  return (
                    <tr key={person.id} className="align-top">
                      <td className="px-4 py-3">
                        <input
                          className={`${inputClass} bg-neutral-900/40`}
                          value={person.name}
                          onChange={(e) =>
                            patchParticipant(person.id, { name: e.target.value })
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        <input
                          className={`${inputClass} bg-neutral-900/40`}
                          placeholder="WhatsApp / mail"
                          value={person.phone ?? ""}
                          onChange={(e) =>
                            patchParticipant(person.id, {
                              phone: e.target.value || null,
                            })
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        <textarea
                          className={`${inputClass} min-h-[70px] resize-y bg-neutral-900/40`}
                          placeholder="Desde el Word: nombre del puesto · después sumás qué trae"
                          value={person.whatBrings ?? ""}
                          onChange={(e) =>
                            patchParticipant(person.id, {
                              whatBrings: e.target.value || null,
                            })
                          }
                        />
                      </td>

                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 text-xs text-neutral-400">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-neutral-600 bg-neutral-900 text-sky-500 focus:ring-sky-500"
                            checked={person.confirmed}
                            onChange={(e) =>
                              patchParticipant(person.id, {
                                confirmed: e.target.checked,
                              })
                            }
                          />
                          listo
                        </label>
                      </td>

                      <td className="px-4 py-3">
                        <select
                          className={`${inputClass} bg-neutral-900/40`}
                          value={stallForPerson?.id ?? ""}
                          onChange={(e) => {
                            const stallId = e.target.value;

                            mutateStalls((list) =>
                              list.map((s) => {
                                if (s.participantId === person.id && s.id !== stallId)
                                  return { ...s, participantId: null };

                                if (stallId && s.id === stallId)
                                  return { ...s, participantId: person.id };

                                return s;
                              }),
                            );
                          }}
                        >
                          <option value="">Sin mesa asignada</option>

                          {state.stalls.map((s) => {
                            const zona = state.venue.zones.find((z) => z.id === s.zoneId);

                            return (
                              <option key={s.id} value={s.id}>
                                {s.label}
                                {zona ? ` (${zona.name})` : ""}
                              </option>
                            );
                          })}
                        </select>
                      </td>

                      <td className="px-4 py-3 text-right align-middle">
                        <button
                          type="button"
                          onClick={() => removeParticipant(person.id)}
                          className="text-[11px] font-semibold text-rose-300 hover:text-rose-200"
                        >
                          borrar fila
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "resumen" && (
        <section className="grid gap-4 md:grid-cols-2">
          <article className="rounded-3xl border border-neutral-800 bg-gradient-to-br from-neutral-950/90 to-neutral-900/55 p-6 shadow-inner shadow-neutral-950/60">
            <h3 className="text-lg font-semibold text-neutral-50">Mesas ocupadas por humano conocido</h3>

            <p className="text-sm text-neutral-400">
              {assignedPeople.size} vínculos person ↔ bloque físico listos para repartir al equipo de
              montaje.
            </p>

            <ul className="mt-4 space-y-2 text-neutral-300">
              {state.stalls
                .filter((stall) => stall.participantId)
                .map((stall) => {
                  const persona = state.participants.find((p) => p.id === stall.participantId);

                  const zona = state.venue.zones.find((z) => z.id === stall.zoneId);

                  return (
                    <li key={stall.id} className="rounded-xl bg-neutral-900/60 px-3 py-2">
                      <span className="font-semibold text-white">{persona?.name ?? "¿?"}</span>
                      {" → "}
                      <span>{stall.label}</span>
                      {zona ?
                        (
                          <>
                            {" "}

                            <span className="text-neutral-400">· {zona.name}</span>
                          </>
                        )
                      : null}
                      {!persona?.confirmed ?
                        (
                          <span className="ml-2 rounded-full bg-amber-900/55 px-2 py-1 text-[10px] uppercase text-amber-200">
                            Falta confirmación final
                          </span>
                        )
                      : null}
                    </li>
                  );

                })}
            </ul>
          </article>

          <article className="rounded-3xl border border-amber-500/30 bg-amber-950/10 p-6">
            <h3 className="text-lg font-semibold text-amber-50">Pendientes / sin casillero</h3>

            <p className="text-sm text-amber-100/80">
              {unassignedParticipants.length} personas todavía no tienen bloque asignado o no marcaste
              confirmación.
            </p>

            <ul className="mt-4 space-y-2 text-sm text-amber-100">
              {unassignedParticipants.map((p) => (
                <li key={p.id} className="rounded-lg bg-amber-950/55 px-3 py-2">
                  {p.name}
                  {!p.confirmed ? " · sin confirmar" : " · sin mesa en el plano"}
                </li>
              ))}

              {!unassignedParticipants.length ?
                <li className="text-emerald-200">Genial: no quedan huérfanos.</li>
              : null}
            </ul>
          </article>
        </section>
      )}

      {tab === "tecnico" && (
        <section className="space-y-6 rounded-3xl border border-neutral-800 bg-neutral-950/50 p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Medidas por zona y grillado</h2>

            <p className="text-sm text-neutral-400">
              El plano trabaja solo con tus polígonos en metros por sector (pasto 14,14 × 8,60, frente
              del plajón, bandas adentro). Acá tocás nombre del evento, la cuadrícula de encaje (1,50 m)
              y el tamaño por defecto de cada mesa.
            </p>
          </div>

          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Nombre corto para el encabezado

            <input
              type="text"
              className={inputClass}
              value={state.venue.name}
              onChange={(e) =>
                setState((prev) =>
                  prev ? { ...prev, venue: { ...prev.venue, name: e.target.value } } : prev,
                )
              }
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-2 text-sm text-neutral-300">
              Cuadrícula de encaje (m)

              <input
                type="number"
                step={0.05}
                min={0.2}
                max={10}
                className={inputClass}
                value={state.venue.snapGridM}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);

                  if (!Number.isFinite(v) || v < 0.2) return;

                  setState((prev) =>
                    prev ? { ...prev, venue: { ...prev.venue, snapGridM: v } } : prev,
                  );
                }}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-neutral-300">
              Ancho por defecto para mesas nuevas (m)

              <input
                type="number"
                step={0.05}
                min={0.45}
                max={12}
                className={inputClass}
                value={state.venue.stallWidthDefaultM}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);

                  if (!Number.isFinite(v) || v < 0.45) return;

                  setState((prev) =>
                    prev ?
                      {
                        ...prev,
                        venue: { ...prev.venue, stallWidthDefaultM: v },
                      }
                    : prev,
                  );
                }}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm text-neutral-300">
              Largo por defecto para mesas nuevas (m)

              <input
                type="number"
                step={0.05}
                min={0.35}
                max={12}
                className={inputClass}
                value={state.venue.stallDepthDefaultM}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value);

                  if (!Number.isFinite(v) || v < 0.35) return;

                  setState((prev) =>
                    prev ?
                      {
                        ...prev,
                        venue: { ...prev.venue, stallDepthDefaultM: v },
                      }
                    : prev,
                  );
                }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-2 text-sm text-neutral-300">
            Zonas (JSON — array de <code className="text-sky-200">PlanZone</code>: id, name, polygonM,
            fill, stroke, hint?)
            <textarea
              className={`${inputClass} min-h-[280px] font-mono text-xs leading-relaxed text-neutral-100`}
              spellCheck={false}
              value={zonesJsonText}
              onChange={(e) => {
                const next = e.target.value;
                setZonesJsonText(next);
                const parsed = parseZonesJson(next);
                if (!parsed) return;
                setState((prev) =>
                  prev ? { ...prev, venue: { ...prev.venue, zones: parsed } } : prev,
                );
                setZonesJsonText(JSON.stringify(parsed, null, 2));
              }}
            />
            <small className="text-[11px] text-neutral-500">
              Podés escribir a mano: mientras no sea JSON válido no cambia los polígonos. Guardá fuera un
              respaldo del <code className="text-neutral-400">state.json</code> antes de cortar grandes
              tramos de geometría.
            </small>
          </label>
        </section>
      )}

      <footer className="border-t border-white/5 pb-24 pt-8 text-[11px] text-neutral-500">
        Hecho especialmente para el evento físico dentro de Biblioteca LP. Si más adelante querés
        sincronización en la nube (Neon, Supabase…) avisamos y exportamos estos mismos registros desde
        `state.json` sin dramas.
      </footer>
    </div>
  );
}
