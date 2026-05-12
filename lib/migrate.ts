import {
  boundingBox,
  centroidPoly,
  clampStallCenter,
} from "./geo";

import type { AppState, Participant, Stall, Venue } from "./types";

import {


  ADENTRO_BANDA_TOTAL_M,

  defaultPlanZones,

} from "./zones-default";


function newSid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();

  return `sid_${Math.random().toString(36).slice(2, 12)}`;
}

function emptyVenue(): Venue {
  return {

    name: "Biblioteca Popular Los Polvorines — plan de feria",

    zones: defaultPlanZones(),


    stallWidthDefaultM: 1,


    stallDepthDefaultM: 2,

    snapGridM: 1.5,

  };

}


/**
 * Guardados con banda «adentro_fila16» de ~16,5 m: el croquis pasa a 22,5 m estirando solo el eje X local.
 */


function widenLegacyAdentro16Zone(venue: Venue): Venue {


  const ix = venue.zones.findIndex((z) => z.id === "adentro_fila16");


  if (ix < 0) return venue;


  const zone = venue.zones[ix]!;


  const poly = zone.polygonM;


  if (!Array.isArray(poly) || poly.length !== 4) return venue;



  const bb = boundingBox(poly);


  const spanX = bb.maxX - bb.minX;


  if (!(spanX > 0.08)) return venue;



  /** Template viejo paralelo nominal 16,5 m antes de llevar texto a 22,5 totales en papel. */


  if (Math.abs(spanX - 16.5) > 0.55) return venue;



  const scale = ADENTRO_BANDA_TOTAL_M / spanX;


  const x0 = bb.minX;


  const stretched = poly.map((p) => ({


    x: x0 + (p.x - x0) * scale,



    y: p.y,

  }));


  const next = venue.zones.map((candidate, zi) =>
    zi === ix ? { ...candidate, polygonM: stretched } : candidate,


  );


  return { ...venue, zones: next };


}




/** Descarta polígonos rotos o demasiado chicos; sin ninguna zona válida vuelve al croquis por defecto. */
function dropInvalidZones(venue: Venue): Venue {
  const ok = venue.zones.filter(
    (z) => Array.isArray(z.polygonM) && z.polygonM.length >= 3,
  );

  return {
    ...venue,
    zones: ok.length ? ok : defaultPlanZones(),
  };
}

/** Estado guardado antes de tener `venue.zones` (un solo polygonM). */

function legacyVenueRecord(venue: unknown): venue is {


  polygonM: { x: number; y: number }[];

  name?: string;

} {


  if (
    typeof venue !== "object" ||
    venue === null
  )
    return false;


  const typed = venue as { polygonM?: unknown; zones?: unknown };

  const hasPoly =
    Array.isArray(typed.polygonM) &&
    typed.polygonM.length > 2;


  const hasZones =
    Array.isArray(typed.zones) &&
    typed.zones.length > 0;


  return hasPoly &&
    !hasZones;
}

/** Normaliza puestos dentro de cualquier zona inválida. */
function coerceStalls(venue: Venue, raw: Partial<Stall>[]): Stall[] {


  const fallbackZone = venue.zones[0]?.id ?? "pasto";


  return raw.map((s, idx) => {

    const preferredId =
      typeof s.zoneId === "string" &&
      venue.zones.some((z) => z.id === s.zoneId) ?
        s.zoneId


      : fallbackZone;


    const zone = venue.zones.find((candidate) => candidate.id === preferredId) ?? venue.zones[0]!;


    const widthM =
      Number.isFinite(s.widthM) &&
      typeof s.widthM === "number" &&
      Number(s.widthM) > 0.2 ?
        Number(s.widthM)


      : venue.stallWidthDefaultM;


    const depthM =
      Number.isFinite(s.depthM) &&
      typeof s.depthM === "number" &&
      Number(s.depthM) > 0.2 ?
        Number(s.depthM)


      : venue.stallDepthDefaultM;


    const rotationDeg =
      typeof s.rotationDeg === "number" && Number.isFinite(s.rotationDeg) ?
        Number(s.rotationDeg)


      : 0;


    let xm = typeof s.xm === "number" && Number.isFinite(s.xm) ? s.xm : Number.NaN;

    let ym = typeof s.ym === "number" && Number.isFinite(s.ym) ? s.ym : Number.NaN;

    const centerGuess = centroidPoly(zone.polygonM);

    if (!Number.isFinite(xm)) xm = centerGuess.x + (idx % 4) * 0.12;

    if (!Number.isFinite(ym)) ym = centerGuess.y + Math.floor(idx / 4) * 0.12;

    const placed = clampStallCenter(
      {


        x: xm,


        y: ym,


      },

      widthM,

      depthM,

      rotationDeg,

      zone.polygonM,

    );

    const category =
      s.category &&
      typeof s.category === "string" &&
      ["comida", "ropa", "libros", "arte", "varios"].includes(s.category) ?
        (s.category as Stall["category"])


      : "varios";

    return {


      id:


        typeof s.id === "string" &&


        s.id.length ?


          s.id


        : newSid(),



      zoneId: zone.id,


      label: typeof s.label === "string" && s.label.trim() ? s.label : `Puesto ${idx + 1}`,


      category,


      xm: placed.x,


      ym: placed.y,


      rotationDeg,


      widthM,

      depthM,

      participantId:
        typeof s.participantId === "string" ?
          s.participantId
        : s.participantId === null ?
          null


        : null,

    };


  });


}

/** Convierte archivos previos (`polygonM`) al modelo multipolígono por zona. */


function migrateFromLegacyVenue(parsed: {


  venue: { polygonM: { x: number; y: number }[]; name?: string };

  stalls?: Partial<Stall>[];

  participants?: Participant[];

  updatedAt?: string;

}): AppState {


  const venue = emptyVenue();

  venue.name =
    parsed.venue?.name?.trim()?.length ?
      `${parsed.venue.name}`


    : venue.name;

  const pasto = venue.zones.find((candidate) => candidate.id === "pasto")!;
  const legacyPoly = parsed.venue.polygonM;


  const obox = boundingBox(legacyPoly);

  const pbox = boundingBox(pasto.polygonM);

  const stallsSource = Array.isArray(parsed.stalls) ? parsed.stalls : [];

  const stallsMapped: Stall[] = stallsSource.map((s, idx) => {

    let xm = typeof s.xm === "number" ? s.xm : Number.NaN;

    let ym = typeof s.ym === "number" ? s.ym : Number.NaN;


    const defaultW =
      venue.stallWidthDefaultM;


    const defaultD =
      venue.stallDepthDefaultM;


    const w =
      Number.isFinite(s.widthM) &&
      typeof s.widthM === "number" &&
      s.widthM > 0.25 ?
        s.widthM


      : defaultW;


    const depthM =
      Number.isFinite(s.depthM) &&
      typeof s.depthM === "number" &&
      s.depthM > 0.25 ?
        s.depthM


      : defaultD;


    const rotationDeg =
      typeof s.rotationDeg === "number" ? s.rotationDeg : 0;

    const spanXO = Math.max(obox.maxX - obox.minX, 1e-9);

    const spanYO = Math.max(obox.maxY - obox.minY, 1e-9);

    if (Number.isFinite(xm) && Number.isFinite(ym)) {


      const fx =
        Math.min(


          1,


          Math.max(


            0,


            (xm - obox.minX) / spanXO,



          ),

        );


      const fy =


        Math.min(



          1,



          Math.max(





            0,





            (ym - obox.minY) / spanYO,




          ),



        );



      xm =
        pbox.minX +
        fx * (pbox.maxX - pbox.minX);



      ym = pbox.minY + fy * (pbox.maxY - pbox.minY);


    } else {


      const c = centroidPoly(pasto.polygonM);


      xm =
        c.x + (idx % 6) * 0.08;


      ym =
        c.y + Math.floor(idx / 6) * 0.08;


    }

    const centered = clampStallCenter({ x: xm, y: ym }, w, depthM, rotationDeg, pasto.polygonM);

    return {


      id:


        typeof s.id === "string" &&


        s.id.length ?


          s.id


        : newSid(),


      zoneId: "pasto",


      label:
        typeof s.label === "string" && s.label.trim() ?
          s.label


        : `Puesto ${idx + 1}`,


      category:
        s.category === "comida" ||
        s.category === "ropa" ||
        s.category === "libros" ||
        s.category === "arte" ||
        s.category === "varios" ?
          s.category


        : "varios",


      xm: centered.x,

      ym: centered.y,

      rotationDeg,

      widthM: w,

      depthM,

      participantId:
        typeof s.participantId === "string" ? s.participantId : null,

    };


  });


  return {


    updatedAt:
      typeof parsed.updatedAt === "string" ?
        parsed.updatedAt


      : new Date().toISOString(),

    venue: dropInvalidZones(venue),


    stalls:


      stallsMapped.length ?


        stallsMapped


      : [],


    participants:


      Array.isArray(parsed.participants) ?




        parsed.participants




      : [],

  };


}

/** Entrada desde disco o cliente: garantiza zonas nuevas + zoneId por puesto. */

export function migrateAppState(raw: unknown): AppState {
  const rec =
    raw &&
    typeof raw === "object" &&
    typeof (raw as AppState).venue === "object" &&
    (raw as AppState).venue !== null ?
      (raw as AppState)
    : null;

  const participantsRaw =
    rec &&
    Array.isArray(rec.participants) ?
      rec.participants.filter(Boolean)
    : [];

  /** Archivo nuevo o incompleto. */
  if (!rec) {


    const venue = emptyVenue();


    return {


      updatedAt: new Date().toISOString(),

      venue,


      stalls: [],


      participants: [],

    };


  }



  const participantsNormalized = participantsRaw as Participant[];

  if (legacyVenueRecord(rec?.venue)) {


    return migrateFromLegacyVenue({


      venue: rec!.venue as { polygonM: { x: number; y: number }[]; name?: string },

      stalls:


        rec!.stalls as Partial<Stall>[] | undefined,

      participants: participantsNormalized,


      updatedAt:


        typeof rec?.updatedAt === "string" ?
          rec.updatedAt


        : undefined,


    });


  }


  const base = emptyVenue();

  const inc = rec?.venue as Partial<Venue> | undefined;


  const venue: Venue = {

    ...base,


    ...inc,



    zones:


      inc?.zones &&


      Array.isArray(inc.zones) &&




      inc.zones.length ?
        inc.zones.map((candidate) => ({




          ...candidate,






          polygonM: candidate.polygonM.map((point) => ({ ...point })),






        }))




      : base.zones,



    stallWidthDefaultM:


      Number.isFinite(inc?.stallWidthDefaultM) ?
        Number(inc!.stallWidthDefaultM)


      : base.stallWidthDefaultM,



    stallDepthDefaultM:


      Number.isFinite(inc?.stallDepthDefaultM) ?
        Number(inc!.stallDepthDefaultM)


      : base.stallDepthDefaultM,

    snapGridM:


      Number.isFinite(inc?.snapGridM) && Number(inc!.snapGridM) > 0.05 ?
        Number(inc!.snapGridM)


      : base.snapGridM,



    name:



      typeof inc?.name === "string" &&
      inc.name.trim().length ?
        inc.name.trim()


      : base.name,

  };


  const stallsIncoming =




    Array.isArray(rec?.stalls) ?
      (rec.stalls as Partial<Stall>[]).filter(Boolean)


    : [];

  const venueFixed = widenLegacyAdentro16Zone(dropInvalidZones(venue));

  return {


    updatedAt:


      typeof rec?.updatedAt === "string" ?
        rec.updatedAt


      : new Date().toISOString(),





    venue: venueFixed,







    stalls:


      coerceStalls(venueFixed, stallsIncoming),




    participants: participantsNormalized,
  };


}

