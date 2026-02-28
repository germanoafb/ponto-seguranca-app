import { NextRequest, NextResponse } from "next/server";
import { hashPassword } from "../../../../lib/password";
import { supabaseServer } from "../../../../lib/supabase-server";

function isPasswordStrong(password: string): boolean {
  return (
    password.length >= 6 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(password)
  );
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, confirmPassword } = await request.json();

    if (!email || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Email, senha e confirmação são obrigatórios." },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ error: "As senhas não conferem." }, { status: 400 });
    }

    if (!isPasswordStrong(String(password))) {
      return NextResponse.json(
        { error: "Senha fora da política de segurança." },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { data: user, error: findError } = await supabaseServer
      .from("cadastros")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const { error } = await supabaseServer
      .from("cadastros")
      .update({ password_hash: hashPassword(String(password)) })
      .eq("email", normalizedEmail);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno ao recuperar senha." }, { status: 500 });
  }
}
