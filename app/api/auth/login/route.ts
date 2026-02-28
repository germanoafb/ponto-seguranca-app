import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "../../../../lib/supabase-server";
import { verifyPassword } from "../../../../lib/password";

function mapErrorToPtBr(message?: string): string {
  const msg = (message || "").toLowerCase();
  if (msg.includes("invalid login credentials")) {
    return "Email ou senha invalidos.";
  }
  if (msg.includes("could not find host") || msg.includes("dns")) {
    return "Nao foi possivel conectar ao Supabase. Verifique NEXT_PUBLIC_SUPABASE_URL no .env.local.";
  }
  if (msg.includes("email not confirmed")) {
    return "Email ainda nao confirmado.";
  }
  return message || "Erro interno ao fazer login.";
}

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: user, error } = await supabaseServer
      .from("cadastros")
      .select("id, name, email, phone, role, active, password_hash")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json(
        { error: "Perfil de cadastro não encontrado para este usuário." },
        { status: 404 }
      );
    }

    if (!user.active) {
      return NextResponse.json(
        { error: "Usuário desativado. Fale com o administrador." },
        { status: 403 }
      );
    }

    const isLocalHashLogin =
      !!user.password_hash && user.password_hash !== "SUPABASE_AUTH";

    if (isLocalHashLogin) {
      const isValidPassword = verifyPassword(String(password), user.password_hash);
      if (!isValidPassword) {
        return NextResponse.json({ error: "Email ou senha invalidos." }, { status: 401 });
      }

      return NextResponse.json({
        token: `local-session-${user.id}`,
        refreshToken: null,
        expiresAt: null,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "Configuracao do Supabase incompleta no servidor." },
        { status: 500 }
      );
    }

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } =
      await supabaseAuthClient.auth.signInWithPassword({
        email: normalizedEmail,
        password: String(password),
      });

    if (authError || !authData.user || !authData.session) {
      return NextResponse.json(
        { error: mapErrorToPtBr(authError?.message) },
        { status: 401 }
      );
    }

    return NextResponse.json({
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      expiresAt: authData.session.expires_at,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao fazer login." },
      { status: 500 }
    );
  }
}
