"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  boundingBox,
  centroidPoly,

  clampStallCenter,

  snapCoord,
  snapPolyToGrid,

  snapStallCenterXY,
  stallCorners,
  scalePolyToEnvelope,
} from "@/lib/geo";
import type { Participant, PlanZone, Pt, Stall, Venue } from "@/lib/types";

import { CATEGORY_COLOR } from "@/lib/types";
import {
  ADENTRO_BANDA_MESAS_16_M,
  ADENTRO_BANDA_TOTAL_16_M,
  AFUERA_MESAS_UTIL_M,
  FACHADA_TOTAL_M,
  PLAJON_ANCHO_INTERIOR_M,
} from "@/lib/zones-default";

type Props = {
  venue: Venue;

  stalls: Stall[];

  participants: Participant[];

  activeZoneId: string;

  onZoneChange: (zoneId: string) => void;

  selectedStallId: string | null;

  onSelectStall: (id: string | null) => void;

  onUpsertStall: (stall: Stall) => void;

  /** Permitir mover vértices y (opcional) redimensionar caja desde el mismo tab. */

  polygonEditActive?: boolean;

  /** Si lo pasás el interruptor aparece pegado al plano (debajo del croquis), muy visible. */
  onPolygonEditActiveChange?: (next: boolean) => void;

  onZonePolygonChange?: (zoneId: string, polygonM: Pt[]) => void;

};

const PAD_M = 0.55;

function polyPath(poly: { x: number; y: number }[]) {
  if (!poly.length) return "";

  const first = poly[0];

  const rest = poly
    .slice(1)
    .map((p) => `L ${p.x} ${p.y}`)
    .join(" ");

  return `M ${first.x} ${first.y} ${rest} Z`;

}

function nameByParticipantMap(participants: Participant[]) {

  const m = new Map<string, string>();

  participants.forEach((p) => m.set(p.id, p.name));

  return m;

}

const MAPSEARCH_LOS_POLVORINES =
  "https://www.google.com/maps/search/?api=1&query=Tom%C3%A1s+Godoy+Cruz+y+Av.+Presidente+Per%C3%B3n%2C+Los+Polverines";

function SchematicBiblioteca() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-[#020617] p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-neutral-500">
        Croquis de referencia tomado del dibujo que mandaste · no es mapa GIS
      </p>

      <svg viewBox="0 0 560 274" className="h-auto w-full max-h-[22rem]" aria-hidden>
        <defs>
          <marker
            id="arrowSchematic"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 z" fill="#94a3b8" />
          </marker>
        </defs>

        <rect width="560" height="274" fill="#020617" />

        {/* ─── Plano IZQUIERDO (pasto / plaza irregular) ─── */}
        <g transform="translate(10,52)">
          <text x="0" y="-22" fill="#94a3b8" fontSize="11" fontWeight={600}>
            Plano izquierdo (plaza · papel)
          </text>

          <path
            d="M 0 16 L 128 14 L 128 122 L 86 146 L 0 146 Z"
            fill="#14532d44"
            stroke="#4ade80"
            strokeWidth="2"
          />

          <text x="4" y="132" fill="#86efac" fontSize="11" fontWeight={600}>
            ancho 14,14 M
          </text>

          <rect
            x="108"
            y="40"
            width="40"
            height="86"
            fill="none"
            stroke="#22c55e"
            strokeWidth="1.6"
            strokeDasharray="5 4"
            opacity={0.95}
          />
          <text x="118" y="86" fill="#bbf7d0" fontSize="9" transform="rotate(-90 138 84)">
            Largo 8,60 M
          </text>

          <circle cx="96" cy="88" r="10" fill="none" stroke="#64748b" strokeWidth="1.2" />
          <path
            d="M 94 82 A 12 12 0 1 1 100 94"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1"
            markerEnd="url(#arrowSchematic)"
          />
        </g>

        {/* ─── Plano DERECHO (biblioteca / plajón rectangular) ─── */}
        <g transform="translate(204,42)">
          <text x="0" y="-8" fill="#94a3b8" fontSize="11" fontWeight={600}>
            Plano derecho (plajón · papel)
          </text>

          <rect
            x="0"
            y="20"
            width="115"
            height="194"
            rx="3"
            fill="#33415533"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          <line
            x1="0"
            y1="152"
            x2="115"
            y2="152"
            stroke="#64748b"
            strokeWidth="1.4"
            strokeDasharray="4 3"
          />
          <text x="57" y="142" fill="#cbd5e1" fontSize="10" textAnchor="middle">
            ANCHO 10,30
          </text>

          <text x="57" y="14" fill="#bfdbfe" fontSize="10" textAnchor="middle" fontWeight={600}>
            Mesas afuera, 8.50 M
          </text>

          <text
            x="-6"
            y="120"
            fill="#f9a8d4"
            fontSize="10"
            textAnchor="middle"
            transform="rotate(-90 -6 120)"
            fontWeight={600}
          >
            mesas adentro pared 13.50m
          </text>

          <text
            x="121"
            y="120"
            fill="#fcd34d"
            fontSize="10"
            textAnchor="middle"
            transform="rotate(90 121 120)"
            fontWeight={600}
          >
            Mesas adentro pared 16,50m
          </text>

          <line
            x1="0"
            y1="20"
            x2="0"
            y2="214"
            stroke="#f472b6"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
          <line
            x1="115"
            y1="20"
            x2="115"
            y2="214"
            stroke="#fbbf24"
            strokeWidth="2"
            strokeDasharray="6 4"
          />

          <g fill="#64748b" opacity={0.55}>
            <circle cx="18" cy="38" r="3" />
            <circle cx="58" cy="34" r="3" />
            <circle cx="97" cy="38" r="3" />
            <circle cx="18" cy="196" r="3" />

            <circle cx="97" cy="196" r="3" />
          </g>

          <rect
            x="0"
            y="214"
            width="115"
            height="24"
            fill="#0f172a55"
            stroke="#475569"
            strokeWidth="1"
          />

          <text x="4" y="206" fill="#94a3b8" fontSize="8">
            Franja inferior (dibujo)
          </text>
        </g>

        {/* Leyenda numérica (mismas cifras que el plano interactivo) */}
        <g transform="translate(340,230)">
          <text x="0" y="0" fill="#64748b" fontSize="9">
            Coherentes con medidas en metros: pasto 14,14 × 8,60 · afuera {AFUERA_MESAS_UTIL_M} m · adentro{" "}
            {ADENTRO_BANDA_MESAS_16_M}/{ADENTRO_BANDA_TOTAL_16_M} m · ancho salón {PLAJON_ANCHO_INTERIOR_M} m
          </text>
        </g>
      </svg>

      <p className="mt-3 max-w-xl text-[11px] leading-relaxed text-neutral-400">
        En el plano interactivo abajo tomamos las mismas medidas; la banda de 16,50 m es un rectángulo completo y
        las mesas van solo en los primeros {ADENTRO_BANDA_MESAS_16_M} m (el resto queda sombreado como equipo).{" "}
        <a
          href={MAPSEARCH_LOS_POLVORINES}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sky-400 underline-offset-4 hover:text-sky-300"
        >
          Tomás Godoy Cruz · Presidente Perón — Los Polvorines
        </a>
      </p>
    </div>
  );
}

function ZoneCanvas({
  zone,

  venue,

  stalls,

  participants,

  selectedStallId,

  onSelectStall,

  onUpsertStall,

  polygonEditActive = false,

  onZonePolygonChange,

}: {

  zone: PlanZone;


  venue: Venue;

  stalls: Stall[];

  participants: Participant[];

  selectedStallId: string | null;

  onSelectStall: (id: string | null) => void;

  onUpsertStall: (stall: Stall) => void;

  polygonEditActive?: boolean;

  onZonePolygonChange?: (zoneId: string, polygonM: Pt[]) => void;


}) {


  const [editDraftPoly, setEditDraftPoly] = useState<Pt[] | null>(null);


  const [vxDragIx, setVxDragIx] = useState<number | null>(null);


  useEffect(() => {


    setEditDraftPoly(null);


    setVxDragIx(null);


  }, [zone.id]);


  useEffect(() => {


    if (!polygonEditActive) {


      setEditDraftPoly(null);


      setVxDragIx(null);


    }


  }, [polygonEditActive]);


  const poly = editDraftPoly ?? zone.polygonM;


  const invalidPoly = poly.length < 3;


  const svgRef = useRef<SVGSVGElement>(null);
  const bbox = useMemo(() => boundingBox(poly), [poly]);

  const spanW = Math.max(bbox.maxX - bbox.minX, 1e-9);


  const spanH = Math.max(bbox.maxY - bbox.minY, 1e-9);



  const bw = spanW + 2 * PAD_M;


  const bh = spanH + 2 * PAD_M;





  const prof = bbox.maxY - bbox.minY;

  const [view, setView] = useState({
    x: bbox.minX - PAD_M,

    y: bbox.minY - PAD_M,

    w: bw * 1.04,

    h: bh * 1.04,

  });


  useEffect(() => {
    const nextBw = spanW + 2 * PAD_M;

    const nextBh = spanH + 2 * PAD_M;


    setView({
      x: bbox.minX - PAD_M,

      y: bbox.minY - PAD_M,

      w: nextBw * 1.04,

      h: nextBh * 1.04,

    });

  }, [bbox.minX, bbox.minY, spanW, spanH]);


  const [ghost, setGhost] = useState<{ id: string; xm: number; ym: number } | null>(null);


  const [drag, setDrag] = useState<{
    id: string;


    offsetX: number;


    offsetY: number;

  } | null>(null);


  const pNames = useMemo(() => nameByParticipantMap(participants), [participants]);

  const stallById = useCallback(
    (id: string) => stalls.find((s) => s.id === id) ?? null,

    [stalls],

  );


  const clientToMeters = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;

    if (!svg) return null;

    const pt = svg.createSVGPoint();

    pt.x = clientX;

    pt.y = clientY;

    const ctm = svg.getScreenCTM();

    if (!ctm) return null;

    try {
      const p = pt.matrixTransform(ctm.inverse());


      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;



      return { x: p.x, y: p.y };


    } catch {


      return null;


    }

  }, []);

  const gridM = venue.snapGridM;

  const vertexScratchRef = useRef<Pt[] | null>(null);

  const onMouseMove = (e: React.MouseEvent) => {
    if (polygonEditActive && vxDragIx !== null && vertexScratchRef.current) {
      const m = clientToMeters(e.clientX, e.clientY);

      if (!m) return;

      const sx = snapCoord(m.x, gridM);
      const sy = snapCoord(m.y, gridM);
      const next = [...vertexScratchRef.current];

      next[vxDragIx] = { x: sx, y: sy };
      vertexScratchRef.current = next;
      setEditDraftPoly(next);

      return;

    }



    if (!drag) return;

    const m = clientToMeters(e.clientX, e.clientY);

    if (!m) return;

    const stall = stallById(drag.id);


    if (!stall) return;

    let nx = m.x - drag.offsetX;

    let ny = m.y - drag.offsetY;


    const c = clampStallCenter(
      { x: nx, y: ny },


      stall.widthM,

      stall.depthM,

      stall.rotationDeg,

      poly,

    );


    nx = c.x;


    ny = c.y;


    const snap = snapStallCenterXY(
      nx,


      ny,

      stall.widthM,

      stall.depthM,

      stall.rotationDeg,

      poly,

      venue.snapGridM,

    );


    setGhost({ id: stall.id, xm: snap.x, ym: snap.y });

  };

  const endDrag = () => {


    if (polygonEditActive && vxDragIx !== null && vertexScratchRef.current && onZonePolygonChange) {


      const done = snapPolyToGrid(
        vertexScratchRef.current.map((punto) => ({ ...punto })),
        gridM,

      );


      if (done.length >= 3) {


        onZonePolygonChange(zone.id, done);


      }


    }



    vertexScratchRef.current = null;


    setVxDragIx(null);


    setEditDraftPoly(null);



    if (drag && ghost && drag.id === ghost.id) {


      const stall = stallById(drag.id);



      if (stall && (ghost.xm !== stall.xm || ghost.ym !== stall.ym)) {


        onUpsertStall({ ...stall, xm: ghost.xm, ym: ghost.ym });


      }


    }


    setDrag(null);


    setGhost(null);


  };

  const onVertexMouseDown = (vertexIndex: number) => (ev: React.MouseEvent) => {


    if (!polygonEditActive || !onZonePolygonChange) return;


    ev.preventDefault();


    ev.stopPropagation();


    onSelectStall(null);


    vertexScratchRef.current = zone.polygonM.map((punto) => ({ ...punto }));


    setEditDraftPoly(vertexScratchRef.current.map((punto) => ({ ...punto })));


    setVxDragIx(vertexIndex);


  };


  const onStallMouseDown = (stall: Stall) => (ev: React.MouseEvent) => {


    if (polygonEditActive) return;



    ev.stopPropagation();


    onSelectStall(stall.id);


    const m = clientToMeters(ev.clientX, ev.clientY);


    if (!m) return;


    setDrag({
      id: stall.id,

      offsetX: m.x - stall.xm,

      offsetY: m.y - stall.ym,

    });

    setGhost({ id: stall.id, xm: stall.xm, ym: stall.ym });

  };

  const gridSmall = 0.5;


  const gridMajor = Math.max(venue.snapGridM || 1.5, 0.5);


  const gridLines = useMemo(() => {
    const lines: {


      x1: number;


      y1: number;


      x2: number;


      y2: number;


      major: boolean;

    }[] = [];


    for (
      let x = Math.floor(bbox.minX / gridSmall) * gridSmall;


      x <= bbox.maxX + gridSmall;


      x += gridSmall


    ) {
      const major =


        Math.abs(x / gridMajor - Math.round(x / gridMajor)) < 0.02;


      lines.push({


        x1: x,

        y1: bbox.minY,

        x2: x,

        y2: bbox.maxY,


        major,

      });


    }


    for (
      let y = Math.floor(bbox.minY / gridSmall) * gridSmall;


      y <= bbox.maxY + gridSmall;


      y += gridSmall


    ) {
      const major =


        Math.abs(y / gridMajor - Math.round(y / gridMajor)) < 0.02;


      lines.push({


        x1: bbox.minX,

        y1: y,

        x2: bbox.maxX,

        y2: y,


        major,

      });


    }


    return lines;

  }, [bbox.minX, bbox.maxX, bbox.minY, bbox.maxY, gridMajor]);

  const puertaStripeM =
    zone.id === "fuera_facade" ? Math.max(0, FACHADA_TOTAL_M - spanW) : 0;

  const dotPat = `dots-${zone.id}`;

  if (invalidPoly) {
    return (
      <div className="flex min-h-[min(88vh,1120px)] items-center justify-center rounded-2xl border border-amber-500/45 bg-neutral-950/80 px-6 py-16 text-center text-sm text-amber-100">
        La zona «{zone.name}» no tiene un polígono válido en metros (necesita al menos 3 puntos con x,y
        finitos).
      </div>
    );
  }

  const adentro16Equipo =
    zone.id === "adentro_fila16"
      ? {
          mesasHastaX: bbox.minX + ADENTRO_BANDA_MESAS_16_M,
          w: Math.max(1e-9, bbox.maxX - (bbox.minX + ADENTRO_BANDA_MESAS_16_M)),
        }
      : null;

  return (
    <div
      className="flex min-h-[min(88vh,1120px)] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-black"
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-800 px-3 py-2 text-xs text-neutral-400">
        <span>


          Grillado cada{" "}


          <strong className="text-neutral-200">{venue.snapGridM} m</strong> · la rueda del mouse sólo mueve la página
          (sin zoom).


        </span>



        <span className={polygonEditActive && onZonePolygonChange ? "text-emerald-300/90" : "text-neutral-500"}>


          {polygonEditActive && onZonePolygonChange ? (
            <>
              Modo forma: puntos cyan (arrastrá) · mesas pausadas · se guarda con el mismo auto-guardado del resto.


            </>
          ) : (
            <>
              <kbd className="rounded border border-neutral-600 px-1 font-mono text-[10px] text-neutral-200">Supr</kbd>


              · atrás borra mesa ·




              <kbd className="rounded border border-neutral-600 px-1 font-mono text-[10px] text-neutral-200">+</kbd>


              agrega mesa


            </>


          )}


        </span>
      </div>

      <svg
        ref={svgRef}


        className="h-[min(88vh,1120px)] w-full flex-1 touch-none cursor-crosshair select-none"


        preserveAspectRatio="xMidYMid meet"


        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}


        onMouseDown={(ev) => {
          if (ev.target === ev.currentTarget) onSelectStall(null);

        }}

      >
        <defs>
          <pattern id={dotPat} width="0.12" height="0.12" patternUnits="userSpaceOnUse">
            <circle cx="0.06" cy="0.06" r="0.02" fill="#1e293b" />
          </pattern>
        </defs>

        <rect
          x={bbox.minX}
          y={bbox.minY}
          width={spanW}
          height={spanH}
          fill={`url(#${dotPat})`}
        />

        {zone.id === "fuera_facade" && puertaStripeM > 0 ? (
          <g opacity={0.9}>
            <rect
              x={bbox.minX - puertaStripeM}


              y={bbox.minY}
              width={puertaStripeM}


              height={prof}


              fill="none"


              stroke="#64748b"

              strokeWidth={0.04}

              strokeDasharray="0.12 0.08"


            />

            <text


              x={bbox.minX - puertaStripeM + 0.12}


              y={bbox.minY + Math.min(prof / 3, 0.45)}


              fill="#94a3b8"


              fontSize={0.13}

            >
              Puerta + portón
            </text>
          </g>
        ) : null}


        {adentro16Equipo ? (
          <g opacity={0.8}>
            <rect
              x={adentro16Equipo.mesasHastaX}
              y={bbox.minY}
              width={adentro16Equipo.w}
              height={prof}
              fill="#7f1d1d44"
              stroke="#f87171"
              strokeWidth={0.03}
              strokeDasharray="0.1 0.08"
            />
            <text
              x={adentro16Equipo.mesasHastaX + adentro16Equipo.w / 2}
              y={bbox.minY + prof / 2}
              fill="#fecaca"
              fontSize={0.12}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              equipo
            </text>
          </g>
        ) : null}


        {gridLines.map((ln, idx) => (
          <line
            key={`${zone.id}-${idx}`}
            x1={ln.x1}
            y1={ln.y1}
            x2={ln.x2}
            y2={ln.y2}
            stroke={ln.major ? "#334155" : "#0f172a"}
            strokeWidth={ln.major ? 0.02 : 0.009}


          />

        ))}

        <path
          d={polyPath(poly)}


          fill={zone.fill}


          stroke={zone.stroke}


          strokeWidth={0.048}


        />

        <g pointerEvents={polygonEditActive ? "none" : "auto"}>


        {stalls.map((stallRaw) => {
          const gx = ghost?.id === stallRaw.id ? ghost.xm : stallRaw.xm;


          const gy = ghost?.id === stallRaw.id ? ghost.ym : stallRaw.ym;


          const stall = { ...stallRaw, xm: gx, ym: gy };


          const pts = stallCorners(
            { x: stall.xm, y: stall.ym },

            stall.widthM,

            stall.depthM,

            stall.rotationDeg,

          );


          const dpath = pts


            .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)


            .concat(" Z")


            .join(" ");


          const selected = stall.id === selectedStallId;


          const fill = CATEGORY_COLOR[stall.category];


          const pname = stall.participantId ? pNames.get(stall.participantId) : null;


          return (
            <g key={stall.id}>
              <path
                d={dpath}


                fill={fill}

                fillOpacity={0.85}

                stroke={selected ? "#f8fafc" : "#020617"}

                strokeWidth={selected ? 0.045 : 0.02}


                onMouseDown={onStallMouseDown(stallRaw)}


                style={{ cursor: drag?.id === stall.id ? "grabbing" : "grab" }}


              />

              <text
                x={stall.xm}


                y={stall.ym}


                textAnchor="middle"


                pointerEvents="none"


              >
                <tspan x={stall.xm} dy="0.04" fill="#fafafa" fontSize={0.1}>
                  {stall.label}
                  {pname ? ` · ${pname}` : ""}
                </tspan>
                <tspan x={stall.xm} dy="0.11" fill="#94a3b8" fontSize={0.065}>
                  {`${stall.widthM.toFixed(2).replace(".", ",")} × ${stall.depthM.toFixed(2).replace(".", ",")} m`}
                </tspan>
              </text>
            </g>
          );

        })}


        </g>



        {polygonEditActive && onZonePolygonChange ?
          (<g>


            {poly.map((vertex, vxIdx) => {


              const activeVx = vxDragIx === vxIdx;


              return (


                <circle


                  key={`${zone.id}-v-${vxIdx}`}


                  cx={vertex.x}


                  cy={vertex.y}


                  r={activeVx ? 0.145 : 0.11}


                  fill="#0f172a"


                  stroke="#22d3ee"


                  strokeWidth={0.034}


                  style={{ cursor: activeVx ? "grabbing" : "grab", touchAction: "none" }}


                  onMouseDown={onVertexMouseDown(vxIdx)}


                />

              );


            })}


          </g>)

        :

          null}



        <line
          x1={bbox.minX}
          y1={bbox.minY}
          x2={bbox.minX}


          y2={bbox.minY + 1}

          stroke="#fbbf24"
          strokeWidth={0.036}
        />

        <text


          x={bbox.minX - 0.04}


          y={bbox.minY + 0.52}


          fill="#fbbf24"


          fontSize={0.095}


          textAnchor="end"


        >
          1 m


        </text>

      </svg>
    </div>
  );


}

export function FloorPlan(props: Props) {
  const {
    venue,

    stalls,

    participants,

    activeZoneId,

    onZoneChange,

    selectedStallId,

    onSelectStall,

    onUpsertStall,

    polygonEditActive = false,

    onPolygonEditActiveChange,

    onZonePolygonChange,

  } = props;


  const activeZone = useMemo(() => {
    const z =
      venue.zones.find((candidato) => candidato.id === activeZoneId) ?? venue.zones[0];
    return z ?? null;
  }, [venue.zones, activeZoneId]);


  const [envW, setEnvW] = useState("");


  const [envH, setEnvH] = useState("");




  /** Al cambiar el polígono (p. ej. al soltar un vértice) actualizamos la caja de texto de envolvente. */

  useEffect(() => {


    if (!polygonEditActive || !activeZone) return;


    const bb = boundingBox(activeZone.polygonM);


    setEnvW((bb.maxX - bb.minX).toFixed(2));


    setEnvH((bb.maxY - bb.minY).toFixed(2));


  }, [polygonEditActive, activeZone]);


  function parseEnvelopeM(txt: string): number {


    const v = Number.parseFloat(txt.trim().replace(",", "."));


    return Number.isFinite(v) ? v : Number.NaN;


  }


  function applyEnvelopeProportional(): void {


    if (!activeZone?.polygonM?.length || !onZonePolygonChange) return;


    const wn = parseEnvelopeM(envW);


    const hn = parseEnvelopeM(envH);


    if (!(wn > 0.2) || !(hn > 0.2)) return;


    const next = snapPolyToGrid(
      scalePolyToEnvelope(activeZone.polygonM, wn, hn),
      venue.snapGridM,

    );


    if (next.length >= 3) {


      onZonePolygonChange(activeZone.id, next);


    }


  }


  function syncEnvelopeFromDrawing(): void {


    if (!activeZone?.polygonM?.length) return;


    const bb = boundingBox(activeZone.polygonM);


    setEnvW((bb.maxX - bb.minX).toFixed(2));


    setEnvH((bb.maxY - bb.minY).toFixed(2));


  }



  const canEditOutline = polygonEditActive && !!onZonePolygonChange;


  return (
    <div className="space-y-6">
      <SchematicBiblioteca />

      {onPolygonEditActiveChange ? (
        <div className="rounded-2xl border-2 border-emerald-400/70 bg-emerald-950/60 px-4 py-4 shadow-lg shadow-black/40">
          <label className="flex cursor-pointer flex-wrap items-start gap-3">
            <input
              type="checkbox"
              checked={polygonEditActive}
              onChange={(event) => onPolygonEditActiveChange(event.target.checked)}
              className="mt-1 h-5 w-5 shrink-0 accent-emerald-400"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-2 text-neutral-50 sm:min-w-[16rem]">
              <span className="block text-base font-bold text-emerald-50">Editar forma (plaza / pasto)</span>
              <span className="block text-sm leading-relaxed text-neutral-300">
                Elegí la zona abajo, marcá acá, y aparecen los puntos cyan en el perímetro.
                Sin marcar: solo lectura.
              </span>
            </span>
          </label>
          {!polygonEditActive ? (
            <p className="mt-3 border-t border-white/15 pt-3 text-xs text-amber-200/95">
              ¿No ves vértices? Marcá la casilla primero.
            </p>
          ) : (
            <p className="mt-3 border-t border-white/15 pt-3 text-xs text-emerald-200">
              Modo activo. Desmarcá para mover mesas.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {venue.zones.map((z) => (
          <button
            key={z.id}
            type="button"
            onClick={() => onZoneChange(z.id)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              activeZoneId === z.id ?
                "bg-sky-600/35 text-sky-50 ring-1 ring-sky-400/55"
              : "bg-neutral-900 text-neutral-400 hover:text-white"


            }`}


          >


            {z.name}


          </button>


        ))}


      </div>


      {activeZone ?
        (<section className="space-y-3">

          <header className="px-1">

            <h3 className="text-lg font-semibold text-white">Área grande de trabajo · zona seleccionada</h3>

            <p className="text-sm font-medium text-sky-200/95">{activeZone.name}</p>

            {activeZone.hint ?
              (<p className="text-sm text-neutral-500">{activeZone.hint}</p>)

            : null}


          </header>

          {canEditOutline && activeZone ?
            (<div className="flex flex-wrap items-end gap-3 rounded-xl border border-emerald-900/55 bg-emerald-950/25 px-4 py-3 text-sm text-neutral-200">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">Ancho caja (m)</span>
                <input
                  className="mt-1 w-28 rounded border border-neutral-600 bg-neutral-950 px-2 py-1 font-mono text-sm text-neutral-100"
                  value={envW}
                  onChange={(e) => setEnvW(e.target.value)}
                />
              </div>

              <div>
                <span className="text-[10px] uppercase tracking-wider text-neutral-500">Largo caja (m)</span>
                <input
                  className="mt-1 w-28 rounded border border-neutral-600 bg-neutral-950 px-2 py-1 font-mono text-sm text-neutral-100"
                  value={envH}
                  onChange={(e) => setEnvH(e.target.value)}
                />
              </div>

              <button
                type="button"
                onClick={applyEnvelopeProportional}
                className="rounded-lg bg-emerald-600/85 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-emerald-500"
              >
                Ajustar proporcional
              </button>

              <button
                type="button"
                onClick={syncEnvelopeFromDrawing}
                className="rounded-lg border border-neutral-600 px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800/60"
              >
                Leer del dibujo
              </button>

              <p className="w-full text-[11px] leading-snug text-neutral-500">
                Escala el contorno respecto al centro para coincidir con la caja envolvente en metros (ej. 14,14 ×
                8,60); podés afinar arrastrando puntos en el plano.
              </p>
            </div>)
          : null}

          <ZoneCanvas


            zone={activeZone}


            venue={venue}


            stalls={stalls.filter((s) => s.zoneId === activeZone.id)}


            participants={participants}


            selectedStallId={selectedStallId}


            onSelectStall={onSelectStall}


            onUpsertStall={onUpsertStall}


            polygonEditActive={canEditOutline}


            onZonePolygonChange={onZonePolygonChange}


          />

        </section>)

      :

        (<p className="rounded-2xl border border-amber-500/35 bg-neutral-950/60 px-4 py-6 text-sm text-amber-100">


          No cargamos zonas de dibujo válidas.


        </p>)

      }


    </div>
  );


}

/** Centro geométrico de una zona (para nuevos puestos). */
export function centroidOfZone(poly: PlanZone["polygonM"]) {


  return centroidPoly(poly);


}

export { centroidPoly as centroid } from "@/lib/geo";
