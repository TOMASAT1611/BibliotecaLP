export type Pt = { x: number; y: number };

export type StallCategory = "comida" | "ropa" | "libros" | "arte" | "varios";

export type PlanZone = {
  id: string;
  name: string;
  polygonM: Pt[];
  /** Relleno del sector (RGBA / hex translúcido). */
  fill: string;
  stroke: string;
  hint?: string;
};

export type Venue = {
  name: string;
  /** Cada zona tiene coordenadas en metros propias del sector (0,0 según ese plano local). */
  zones: PlanZone[];
  /** Mesas nuevas: ancho (m), lado paralelo al eje X local antes de `rotationDeg`. */
  stallWidthDefaultM: number;
  /** Mesas nuevas: largo / fondo (m), lado paralelo al eje Y local antes de `rotationDeg`. */
  stallDepthDefaultM: number;
  /** Encaje al mover mesas (1,50 m = cuadrícula de cada puesto). */
  snapGridM: number;
};

export type Stall = {
  id: string;
  /** Zona donde viven xm, ym locales. */
  zoneId: string;
  label: string;
  category: StallCategory;
  xm: number;
  ym: number;
  rotationDeg: number;
  /** Ancho en metros (eje local X antes de rotar). */
  widthM: number;
  /** Largo / fondo en metros (eje local Y antes de rotar). */
  depthM: number;
  participantId: string | null;
};

export type Participant = {
  id: string;
  name: string;
  phone: string | null;
  whatBrings: string | null;
  confirmed: boolean;
};

export type AppState = {
  venue: Venue;
  stalls: Stall[];
  participants: Participant[];
  updatedAt: string;
};

export const CATEGORY_LABEL: Record<StallCategory, string> = {
  comida: "Comida / bebida",
  ropa: "Ropa",
  libros: "Libros",
  arte: "Arte / artesanías",
  varios: "Varios",
};

export const CATEGORY_COLOR: Record<StallCategory, string> = {
  comida: "#f59e0b",
  ropa: "#8b5cf6",
  libros: "#10b981",
  arte: "#f43f5e",
  varios: "#64748b",
};
