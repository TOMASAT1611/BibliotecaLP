import mammoth from "mammoth";

import { NextResponse } from "next/server";

type Row = {
  name: string;


  phone: string | null;


  whatBrings: string | null;

};

function parseParticipantRows(text: string): Row[] {


  const lines = text


    .split(/\r?\n/)


    .map((ln) => ln.trim())


    .filter(Boolean)

    .filter((ln) => !ln.startsWith("#"));


  const rows: Row[] = [];


  for (const line of lines) {
    let parts: string[];


    if (line.includes("\t")) parts = line.split("\t");


    else if (line.includes(";")) parts = line.split(";").map((s) => s.trim());


    else parts = [line];

    const nameRaw = parts[0]?.trim() ?? "";


    if (!nameRaw) continue;


    const phoneRaw = parts[1]?.trim() ?? "";


    const bringRaw = parts.slice(2).join(" ").trim() || "";

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
        "Recomendado en Word: una persona por línea, o columnas separadas por tabulador: Nombre [TAB] teléfono [TAB] qué trae",

      participants: rows,

    });

  } catch {


    return NextResponse.json({ error: "Falló la lectura del Word." }, { status: 500 });

  }


}
