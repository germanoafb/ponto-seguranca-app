import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { listPontoRegistros } from "../../../../lib/pontos";
import { supabaseServer } from "../../../../lib/supabase-server";
import { formatDateTimeBr } from "../../../../lib/datetime";

export const runtime = "nodejs";

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeCellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeCellValue(item))
      .filter(Boolean)
      .join(" | ");
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requesterEmail = searchParams.get("requesterEmail")?.trim().toLowerCase();
    const query = searchParams.get("query")?.trim().toLowerCase();
    const from = toIsoOrNull(searchParams.get("from"));
    const to = toIsoOrNull(searchParams.get("to"));

    if (!requesterEmail) {
      return NextResponse.json({ error: "requesterEmail é obrigatório." }, { status: 400 });
    }

    const { data: requester, error: requesterError } = await supabaseServer
      .from("cadastros")
      .select("role, active")
      .eq("email", requesterEmail)
      .maybeSingle();

    if (requesterError) {
      return NextResponse.json({ error: requesterError.message }, { status: 500 });
    }

    if (!requester || requester.role !== "admin" || !requester.active) {
      return NextResponse.json({ error: "Acesso permitido apenas para admin." }, { status: 403 });
    }

    const registros = await listPontoRegistros({
      query,
      fromIso: from,
      toIso: to,
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Relatório de Pontos");

    sheet.columns = [
      { header: "Data", key: "data", width: 22 },
      { header: "Nome", key: "nome", width: 28 },
      { header: "Email", key: "email", width: 32 },
      { header: "Cargo", key: "cargo", width: 20 },
      { header: "Tipo", key: "tipo", width: 18 },
      { header: "Selfie URL", key: "selfieUrl", width: 50 },
      { header: "Observação", key: "observacao", width: 42 },
    ];

    for (const row of registros) {
      sheet.addRow({
        data: row.dataLocal || formatDateTimeBr(row.criadoEmIso),
        nome: normalizeCellValue(row.nome),
        email: normalizeCellValue(row.email),
        cargo: normalizeCellValue(row.role),
        tipo: normalizeCellValue(row.tipo),
        selfieUrl: normalizeCellValue(row.selfieUrl),
        observacao: normalizeCellValue(row.observacao),
      });
    }

    const header = sheet.getRow(1);
    header.font = { bold: true };

    sheet.eachRow((currentRow) => {
      currentRow.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    });

    const date = new Date().toISOString().slice(0, 10);
    const fileBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=relatorio-pontos-${date}.xlsx`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao exportar relatório." },
      { status: 500 }
    );
  }
}
