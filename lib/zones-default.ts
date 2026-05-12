import type { PlanZone, Pt } from "./types";

/** Largo total en planta de la banda interior paralela a la pared larga (comida · música · equipo). */
export const ADENTRO_BANDA_TOTAL_M = 22.5;


/** Mesas (comida) sobre esa banda, en metros. */
export const ADENTRO_BANDA_MESAS_M = 16.5;


/** Tramo para música / sonido / cableado inmediatamente detrás de las mesas. */
export const ADENTRO_MUSICA_EQUIPO_M = 2.2;


/** Equipo y paso después de música (dentro del mismo rectángulo de 22,50 m). */
export const ADENTRO_BANDA_TAIL_M =
  ADENTRO_BANDA_TOTAL_M - ADENTRO_BANDA_MESAS_M - ADENTRO_MUSICA_EQUIPO_M;

/** Alias histórico para leyendas ya usadas en código. */
export const ADENTRO_BANDA_TOTAL_16_M = ADENTRO_BANDA_TOTAL_M;


/** Alias: tramo ocupado por mesas (16,50 m). */


export const ADENTRO_BANDA_MESAS_16_M = ADENTRO_BANDA_MESAS_M;

/** Anchura típica del salón marcada como “ANCHO 10,30” en tu plano derecho (referencia geométrica). */
export const PLAJON_ANCHO_INTERIOR_M = 10.3;

/** Recorte muy chico en la esquina inferior derecha (metros), proporcional al dibujo físico (“puntita”). */
export const PASTO_CHAMFER_CLIP_X_M = 0.32;


export const PASTO_CHAMFER_CLIP_Y_M = 0.36;

/**
 * Plaza: rectángulo ~14,14 × 8,60 m en planta + bisel diminuto abajo‑a la derecha (no un triángulo grande).
 */
export function zonaPastoChamferM(): Pt[] {
  const W = 14.14;


  const H = 8.6;


  /** No más del 8 % del lado — evita recuperar accidentalmente la forma “mega bisel”. */
  const dx = Math.min(PASTO_CHAMFER_CLIP_X_M, W * 0.08);


  const dy = Math.min(PASTO_CHAMFER_CLIP_Y_M, H * 0.08);


  return [
    { x: 0, y: 0 },
    { x: W, y: 0 },
    { x: W, y: H - dy },
    { x: W - dx, y: H },
    { x: 0, y: H },
  ];

}

/** Referencia textual de fachada; la franja no-mesas sale por diferencia hasta 8,50 m de mesas. */
export const FACHADA_TOTAL_M = 11.79;

/** Ancho sobre la fachada donde van solo mesas (dibujo papel). */
export const AFUERA_MESAS_UTIL_M = 8.5;

const FRANJA_PUERTA_PORTON = FACHADA_TOTAL_M - AFUERA_MESAS_UTIL_M;

const PROF_MESAS_FUERA = 4;

const PROF_ADENTRO = 4;



const LADO_MESAS_INTERIOR_LARGO_PARALELO_M = ADENTRO_BANDA_TOTAL_M;



const LADO_MESAS_PARED_13_M = 13.5;

export function defaultPlanZones(): PlanZone[] {
  const pasto = zonaPastoChamferM();


  const x0 = FRANJA_PUERTA_PORTON;


  const x1 = FACHADA_TOTAL_M;


  const fuera: PlanZone = {
    id: "fuera_facade",
    name: "Mesas afuera (frente plajón) — 8,50 m útiles",
    polygonM: [
      { x: x0, y: 0 },
      { x: x1, y: 0 },
      { x: x1, y: PROF_MESAS_FUERA },
      { x: x0, y: PROF_MESAS_FUERA },
    ],
    fill: "#1e3a5f55",
    stroke: "#60a5fa",
    hint:
      `Sobre los ${FACHADA_TOTAL_M} m de frente (${FRANJA_PUERTA_PORTON.toFixed(2)} m sin mesas puerta/portón — ${AFUERA_MESAS_UTIL_M} m solo mesas, como marcás arriba en el papel).`,
  };

  /** Polígono 0→22,50 m × profundo interior: primeros 16,50 mesas · 2,20 música · resto equipo. */
  const adentro16: PlanZone = {
    id: "adentro_fila16",
    name:


      `Mesas adentro — pared larga (${ADENTRO_BANDA_TOTAL_M} m · ${ADENTRO_BANDA_MESAS_M} mesas · ${ADENTRO_MUSICA_EQUIPO_M} m música)`,

    polygonM: [
      { x: 0, y: 0 },
      { x: LADO_MESAS_INTERIOR_LARGO_PARALELO_M, y: 0 },
      {
        x: LADO_MESAS_INTERIOR_LARGO_PARALELO_M,
        y: PROF_ADENTRO,
      },
      { x: 0, y: PROF_ADENTRO },
    ],
    fill: "#42200655",
    stroke: "#fcd34d",
    hint:


      `Los primeros ${ADENTRO_BANDA_MESAS_M} m llevan mesas de comida; después ${ADENTRO_MUSICA_EQUIPO_M} m marcados como «música/equipo» en el dibujo sombreado; los últimos ${ADENTRO_BANDA_TAIL_M} m completan el rectángulo hasta ${ADENTRO_BANDA_TOTAL_M} m (equipo · paso).`,
  };


  const adentro13: PlanZone = {
    id: "adentro_fila135",
    name: "Mesas adentro — pared 13,50 m (otro costado del salón)",
    polygonM: [
      { x: 0, y: 0 },
      { x: LADO_MESAS_PARED_13_M, y: 0 },
      { x: LADO_MESAS_PARED_13_M, y: PROF_ADENTRO },
      { x: 0, y: PROF_ADENTRO },
    ],
    fill: "#36031d55",
    stroke: "#f472b6",
    hint:
      "Banda según la pared de 13,50 m de tu croquis; el centro del plajón queda libre entre filas.",
  };

  const pastoz: PlanZone = {
    id: "pasto",
    name: "Plaza pasto — ancho 14,14 m · largo 8,60 m (recorte mínimo · esquina inferior derecha)",
    polygonM: pasto.map((punto) => ({ ...punto })),
    fill: "#134e2a62",
    stroke: "#86efac",
    hint: "Casí rectángulo sobre 14,14 × 8,60 m; la esquina inferior derecha solo corta una puntita muy chica.",

  };


  return [pastoz, fuera, adentro16, adentro13];

}
