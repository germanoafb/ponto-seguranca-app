import { NextRequest, NextResponse } from "next/server";
import { listPontoRegistros } from "../../../lib/pontos";
import { supabaseServer } from "../../../lib/supabase-server";

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

    const filtrados = await listPontoRegistros({
      query,
      fromIso: from,
      toIso: to,
    });

    return NextResponse.json({ success: true, registros: filtrados });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao gerar relatório." },
      { status: 500 }
    );
  }
}
