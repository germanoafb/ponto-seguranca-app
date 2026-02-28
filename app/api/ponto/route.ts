import { NextRequest, NextResponse } from "next/server";
import { appendPontoRegistro, listPontoRegistros, PontoTipo } from "../../../lib/sheets-ponto";
import { supabaseServer } from "../../../lib/supabase-server";

const MIN_BREAK_MINUTES = 20;

function toIsoOrNull(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    const from = toIsoOrNull(searchParams.get("from"));
    const to = toIsoOrNull(searchParams.get("to"));

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 });
    }

    const registros = await listPontoRegistros();

    const filtrados = registros
      .filter((registro) => registro.email === email)
      .filter((registro) => {
        const ts = new Date(registro.criadoEmIso).getTime();
        if (from && ts < new Date(from).getTime()) return false;
        if (to && ts > new Date(to).getTime()) return false;
        return true;
      })
      .sort((a, b) => new Date(b.criadoEmIso).getTime() - new Date(a.criadoEmIso).getTime());

    return NextResponse.json({ success: true, registros: filtrados });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao buscar pontos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      email,
      tipo,
      latitude,
      longitude,
      selfieUrl,
      observacao,
    }: {
      email?: string;
      tipo?: PontoTipo;
      latitude?: number;
      longitude?: number;
      selfieUrl?: string;
      observacao?: string;
    } = await request.json();

    if (!email || !tipo) {
      return NextResponse.json(
        { error: "Email e tipo de ponto são obrigatórios." },
        { status: 400 }
      );
    }

    const tipos: PontoTipo[] = ["entrada", "inicio_descanso", "fim_descanso", "saida"];
    if (!tipos.includes(tipo)) {
      return NextResponse.json({ error: "Tipo de ponto inválido." }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: cadastro, error: cadastroError } = await supabaseServer
      .from("cadastros")
      .select("name, email, role, active")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (cadastroError) {
      return NextResponse.json({ error: cadastroError.message }, { status: 500 });
    }

    if (!cadastro) {
      return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
    }

    if (!cadastro.active) {
      return NextResponse.json({ error: "Usuário inativo." }, { status: 403 });
    }

    if (tipo === "fim_descanso") {
      const registros = await listPontoRegistros();
      const userRows = registros
        .filter((item) => item.email === normalizedEmail)
        .sort((a, b) => new Date(a.criadoEmIso).getTime() - new Date(b.criadoEmIso).getTime());

      const ultimoInicioDescanso = [...userRows].reverse().find((item) => item.tipo === "inicio_descanso");

      if (!ultimoInicioDescanso) {
        return NextResponse.json(
          { error: "Não existe início de descanso para encerrar." },
          { status: 400 }
        );
      }

      const diffMinutes = Math.floor(
        (Date.now() - new Date(ultimoInicioDescanso.criadoEmIso).getTime()) / 60000
      );

      if (diffMinutes < MIN_BREAK_MINUTES) {
        return NextResponse.json(
          {
            error: `Descanso mínimo de ${MIN_BREAK_MINUTES} minutos. Aguarde mais ${
              MIN_BREAK_MINUTES - diffMinutes
            } minuto(s).`,
          },
          { status: 400 }
        );
      }
    }

    const now = new Date();

    await appendPontoRegistro({
      criadoEmIso: now.toISOString(),
      dataLocal: new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "medium",
        timeZone: "America/Sao_Paulo",
      }).format(now),
      email: normalizedEmail,
      nome: cadastro.name,
      role: cadastro.role,
      tipo,
      latitude: typeof latitude === "number" ? latitude : null,
      longitude: typeof longitude === "number" ? longitude : null,
      selfieUrl: selfieUrl ?? null,
      observacao: observacao ?? null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao registrar ponto." },
      { status: 500 }
    );
  }
}
