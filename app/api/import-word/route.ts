import mammoth from "mammoth";

import { NextResponse } from "next/server";

type Row = {
  name: string;

  phone: string | null;

  whatBrings: string | null;

};

function splitLineCells(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((s) => s.trim());

  if (line.includes(";")) return line.split(";").map((s) => s.trim());

  const normalized = line.replace(/\u00a0/g, " ").trim();


  return [normalized];

}

/** Encabezado de tabla tipo “Listado de puestos…”. */
function looksLikeStallTableHeader(cells: string[]): boolean {


  const joined = cells.join(" ").toLowerCase();


  if (/\bn°\s*d?e?\s*puesto\b|\bn[uú]mero\s*d?e?\s*puesto\b/.test(joined)) return true;


  return (


    /\bnombre\s+del\s+responsable\b/.test(joined)


    && /\b(emprendimiento|nombre\s+del\s+emprendimiento)\b/.test(joined)


  );

}

/** Una fila de listado institucional: Nº · Responsable · Emprendimiento. */


function parseStallListRow(cells: string[]): Row | null {


  if (cells.length < 3) return null;


  const stall = cells[0]?.trim() ?? "";


  if (!/^\d+$/.test(stall)) return null;


  const responsable = cells[1]?.trim() ?? "";


  if (!responsable) return null;


  const venture = cells.slice(2).join(" ").trim();


  return {
    name: responsable,
    phone: null,

    whatBrings: venture ? `[Puesto ${stall}] ${venture}` : `[Puesto ${stall}]`,
  };


}

function parseParticipantRows(text: string): Row[] {


  const lines = text


    .split(/\r?\n/)

    .map((ln) => ln.replace(/\u00a0/g, " ").trim())


    .filter(Boolean)


    .filter((ln) => !ln.startsWith("#"));

  const rows: Row[] = [];


  for (const line of lines) {


    const cells = splitLineCells(line).filter((s) => s.length > 0);


    if (!cells.length) continue;


    if (cells.length === 1 && /^listado\s+de\b/i.test(cells[0])) continue;


    if (looksLikeStallTableHeader(cells)) continue;


    const listRow = parseStallListRow(cells);


    if (listRow) {
      rows.push(listRow);


      continue;


    }


    const nameRaw = cells[0]?.trim() ?? "";


    if (!nameRaw) continue;


    const phoneRaw = cells[1]?.trim() ?? "";


    const bringRaw = cells.slice(2).join(" ").trim() || "";

    rows.push({
      name: nameRaw,

      phone: phoneRaw ? phoneRaw : null,

      whatBrings: bringRaw ? bringRaw : null,

    });


  }


  return rows;


}

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") ?? "";

    if (!ct.includes("multipart/form-data"))

      return NextResponse.json({ error: "Adjuntá un .docx en el formulario." }, { status: 415 });


    const form = await req.formData();


    const file = form.get("file");


    if (!(file instanceof File))


      return NextResponse.json({ error: "Sin archivo." }, { status: 400 });

    if (!(file.type ===

        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))


      return NextResponse.json(
        {


          error: "Solo .docx (Word moderno). Si tenés .doc viejo guardá como .docx.",


        },


        { status: 415 },


      );


    const buffer = Buffer.from(await file.arrayBuffer());


    const { value } = await mammoth.extractRawText({ buffer });


    const rows = parseParticipantRows(value);


    if (!rows.length)


      return NextResponse.json({ error: "No encontré líneas con texto usable." }, { status: 422 });

    return NextResponse.json({
      hint:


        "Si importás una tabla institucional, que las columnas vengan separadas por tabulador en el .docx. " +
        "También: una persona por línea, o Nombre[TAB] teléfono[TAB] qué trae.",


      participants: rows,

    });


  } catch {


    return NextResponse.json({ error: "Falló la lectura del Word." }, { status: 500 });


  }


}
