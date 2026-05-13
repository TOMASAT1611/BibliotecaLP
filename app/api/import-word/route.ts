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

function nextNonEmptyIndex(lines: string[], start: number): number {
  let j = start;
  while (j < lines.length && !lines[j]) j += 1;
  return j;
}

/** Palabras típicas de encabezado en una celda sola (evita falsos merges). */
function looksLikeHeaderCellSnippet(s: string): boolean {
  const t = s.toLowerCase();
  if (/^n[uú]?°?\s*d?e?\s*puesto\b/.test(t)) return true;

  if (/\bnombre\s+del\s+titular\b/.test(t) || /\bnombre\s+del\s+responsable\b/.test(t)) return true;

  if (/\bnombre\s+del\s+puesto\b/.test(t) || /\bnombre\s+del\s+emprendimiento\b/.test(t)) return true;

  return false;
}

function looksLikeStandaloneStallCell(s: string): boolean {
  if (!/^\d{1,5}$/.test(s)) return false;

  // Evitar fusionar años típicos (celdas tipo “2024” fuera del listado de puestos).
  if (/^(19|20)\d{2}$/.test(s)) return false;

  return true;
}

/**
 * Mammoth suele sacar tablas como una celda por línea: número, titular, nombre del puesto en líneas sucesivas.
 * Armamos una fila TAB única para parseStallListRow.
 */
function collapseVerticalInstitutionalTriplets(trimmedLines: string[]): string[] {
  const out: string[] = [];

  let i = 0;
  while (i < trimmedLines.length) {
    const line = trimmedLines[i];

    if (!line) {
      i += 1;
      continue;
    }

    if (looksLikeStandaloneStallCell(line)) {
      const j = nextNonEmptyIndex(trimmedLines, i + 1);

      const k = nextNonEmptyIndex(trimmedLines, j + 1);

      const titular = j < trimmedLines.length ? trimmedLines[j] : "";

      const empresa = k < trimmedLines.length ? trimmedLines[k] : "";

      if (
        titular &&
        empresa &&
        j < trimmedLines.length &&
        k < trimmedLines.length &&
        !looksLikeHeaderCellSnippet(titular) &&
        !looksLikeHeaderCellSnippet(empresa)
      ) {
        out.push(`${line}\t${titular}\t${empresa}`);

        i = k + 1;

        continue;
      }
    }

    out.push(line);

    i += 1;
  }

  return out;
}

/**
 * Variante Mammoth: “nº + tab + titular” en una línea y “nombre del puesto” en la siguiente (sin tab).
 */
function mergeStallTitularWithTrailingEmpresaLine(lines: string[]): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const cur = lines[i] ?? "";

    const cells = splitLineCells(cur).filter((s) => s.length > 0);

    const nextLine = lines[i + 1];
    const nextCells = typeof nextLine === "string" ? splitLineCells(nextLine).filter((s) => s.length > 0) : [];

    if (
      cells.length === 2 &&
      typeof nextLine === "string" &&
      looksLikeStandaloneStallCell(cells[0] ?? "") &&
      (cells[1]?.length ?? 0) > 0 &&
      nextCells.length === 1 &&
      nextCells[0]?.length &&
      !looksLikeHeaderCellSnippet(nextCells[0] ?? "") &&
      !looksLikeStandaloneStallCell(nextCells[0] ?? "") &&
      !looksLikeHeaderCellSnippet(cells[1] ?? "")
    ) {
      out.push(`${cells[0]}\t${cells[1]}\t${nextCells[0]}`);

      i += 2;

      continue;
    }

    out.push(cur);

    i += 1;
  }

  return out;
}

/** Encabezado de tabla tipo “Listado de puestos…”. */
function looksLikeStallTableHeader(cells: string[]): boolean {


  const joined = cells.join(" ").toLowerCase();


  if (/\bn°\s*d?e?\s*puesto\b|\bn[uú]mero\s*d?e?\s*puesto\b/.test(joined)) return true;


  return (
    /\bnombre\s+del\s+(titular|responsable)\b/.test(joined) &&
      /\b(emprendimiento|nombre\s+del\s+emprendimiento|nombre\s+del\s+puesto)\b/.test(joined)
  );


}

/** Tabla institucional: nº · titular/responsable · nombre del emprendimiento/puesto. */


function parseStallListRow(cells: string[]): Row | null {


  if (cells.length < 3) return null;


  const stall = cells[0]?.trim() ?? "";


  if (!/^\d+$/.test(stall)) return null;


  const titular = cells[1]?.trim() ?? "";


  if (!titular) return null;


  const nombrePuesto = cells.slice(2).join(" ").trim();


  const tagPuesto = ` · puesto nº ${stall}`;


  return {
    name: titular,
    phone: null,

    whatBrings: nombrePuesto ? nombrePuesto + tagPuesto : `Puesto nº ${stall}`.trim(),
  };


}

function parseParticipantRows(text: string): Row[] {
  const trimmed = text
    .split(/\r?\n/)
    .map((ln) => ln.replace(/\u00a0/g, " ").trim())
    .filter((ln) => !ln.startsWith("#"));

  const lines = mergeStallTitularWithTrailingEmpresaLine(
    collapseVerticalInstitutionalTriplets(trimmed),
  ).filter(Boolean);

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


        "Tabla institucional: nº[TAB o salto de línea] titular[TAB o salto de línea] nombre del puesto. " +
        "El teléfono y los detalles de “qué trae” los completás después. También: una persona por línea o " +
        "Nombre[TAB] teléfono[TAB] qué lleva.",


      participants: rows,

    });


  } catch {


    return NextResponse.json({ error: "Falló la lectura del Word." }, { status: 500 });


  }


}
