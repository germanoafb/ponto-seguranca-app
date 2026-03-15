import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { supabaseServer } from "../../../lib/supabase-server";

export const runtime = "nodejs";

type Funcao = "seguranca" | "bombeiro_civil";

function formatCargo(role: string): string {
  if (role === "bombeiro_civil") return "Bombeiro Civil";
  if (role === "seguranca") return "Segurança";
  return role;
}

function normalizeFuncao(value: unknown): Funcao {
  return String(value || "seguranca").trim().toLowerCase() === "bombeiro_civil"
    ? "bombeiro_civil"
    : "seguranca";
}

function parseMonthYear(value: string): { month: number; year: number } | null {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }
  return { month, year };
}

export async function POST(request: NextRequest) {
  try {
    const {
      requesterEmail,
      cnpj,
      contratante,
      contratada,
      mesAno,
      enderecoTitas,
      enderecoContratante,
      nomeColaborador,
      funcao,
    }: {
      requesterEmail?: string;
      cnpj?: string;
      contratante?: string;
      contratada?: string;
      mesAno?: string;
      enderecoTitas?: string;
      enderecoContratante?: string;
      nomeColaborador?: string;
      funcao?: Funcao;
    } = await request.json();

    if (!requesterEmail) {
      return NextResponse.json({ error: "requesterEmail é obrigatório." }, { status: 400 });
    }

    if (
      !cnpj ||
      !contratante ||
      !contratada ||
      !mesAno ||
      !enderecoTitas ||
      !enderecoContratante ||
      !nomeColaborador
    ) {
      return NextResponse.json(
        {
          error:
            "CNPJ, contratante, contratada, mês/ano, endereço da contratante, nome e função são obrigatórios.",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = requesterEmail.trim().toLowerCase();
    const parsedMonthYear = parseMonthYear(mesAno);
    if (!parsedMonthYear) {
      return NextResponse.json({ error: "Formato de Mês/Ano inválido." }, { status: 400 });
    }

    const { month, year } = parsedMonthYear;
    const normalizedFuncao = normalizeFuncao(funcao);

    const { data: requester, error: requesterError } = await supabaseServer
      .from("cadastros")
      .select("role, active")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (requesterError) {
      return NextResponse.json({ error: requesterError.message }, { status: 500 });
    }

    if (!requester || requester.role !== "admin" || !requester.active) {
      return NextResponse.json({ error: "Acesso permitido apenas para admin." }, { status: 403 });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Folha1");

    sheet.columns = [
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 48 },
    ];

    sheet.mergeCells("A2:E2");
    sheet.getCell("A2").value = "FOLHA DE PONTO INDIVIDUAL";
    sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell("A2").font = { bold: true, size: 14 };

    sheet.mergeCells("A3:E3");
    sheet.getCell("A3").value = `Contratada: ${contratada}`;
    sheet.getCell("A3").font = { bold: true };

    sheet.mergeCells("A4:E4");
    sheet.getCell("A4").value = `Endereço: ${enderecoTitas}`;

    sheet.mergeCells("A5:E5");
    sheet.getCell("A5").value = `C.N.P.J.: ${cnpj}`;

    sheet.mergeCells("A6:E6");
    sheet.getCell("A6").value = `Contratante: ${contratante}`;
    sheet.getCell("A6").font = { bold: true };

    sheet.mergeCells("A7:E7");
    sheet.getCell("A7").value = `Endereço: ${enderecoContratante}`;

    const monthYearLabel = `${String(month).padStart(2, "0")}/${year}`;
    sheet.mergeCells("A8:E8");
    sheet.getCell("A8").value = `Mês: ${monthYearLabel}.      Colaborador: ${nomeColaborador}   Função: ${formatCargo(normalizedFuncao)}`;

    sheet.getRow(9).values = ["DIA", "H.ENTRADA", "INTERVALO", "H.SAÍDA", "ASSINATURA"];
    sheet.getRow(9).font = { bold: true };
    sheet.getRow(9).alignment = { horizontal: "center", vertical: "middle" };

    sheet.getRow(10).values = ["", "07:00", "", "19:00", ""];
    sheet.getRow(10).alignment = { horizontal: "center", vertical: "middle" };

    const totalDays = new Date(year, month, 0).getDate();
    for (let day = 1; day <= totalDays; day += 1) {
      const rowIndex = 10 + day;
      sheet.getCell(`A${rowIndex}`).value = `${day}/${month}/${year}`;
      sheet.getRow(rowIndex).alignment = { horizontal: "center", vertical: "middle" };
      sheet.getCell(`E${rowIndex}`).alignment = { horizontal: "left", vertical: "middle" };
    }

    const lastRow = 10 + totalDays;
    for (let row = 2; row <= lastRow; row += 1) {
      for (const column of ["A", "B", "C", "D", "E"]) {
        sheet.getCell(`${column}${row}`).border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      }
    }

    const safeName = nomeColaborador
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    const fileBuffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=folha-ponto-${safeName || "colaborador"}-${monthYearLabel.replace("/", "-")}.xlsx`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar planilha." },
      { status: 500 }
    );
  }
}
