import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";
import { hashPassword } from "../../../../lib/password";

function mapErrorToPtBr(message?: string): string {
  const msg = (message || "").toLowerCase();
  if (msg.includes("could not find host") || msg.includes("dns")) {
    return "Nao foi possivel conectar ao Supabase. Verifique a URL do projeto no .env.local.";
  }
  if (msg.includes("already") || msg.includes("registered")) {
    return "Este email ja esta cadastrado.";
  }
  return message || "Erro interno ao cadastrar usuario.";
}

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
    const { name, email, phone, password } = await request.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Nome, email e senha são obrigatórios." },
        { status: 400 }
      );
    }

    if (!isPasswordStrong(password)) {
      return NextResponse.json(
        {
          error:
            "A senha deve ter 6+ caracteres, uma maiúscula, uma minúscula e um caractere especial.",
        },
        { status: 400 }
      );
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedName = String(name).trim();
    const normalizedPhone = phone ? String(phone).replace(/\D/g, "") : null;
    const localPasswordHash = hashPassword(String(password));

    const { data: existingUser, error: existingUserError } = await supabaseServer
      .from("cadastros")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingUserError) {
      return NextResponse.json(
        { error: mapErrorToPtBr(existingUserError.message) },
        { status: 500 }
      );
    }

    if (existingUser) {
      return NextResponse.json(
        { error: "Este email já está cadastrado." },
        { status: 409 }
      );
    }

    const { error: authError } =
      await supabaseServer.auth.admin.createUser({
        email: normalizedEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: {
          name: normalizedName,
          phone: normalizedPhone,
        },
      });

    const authMessage = authError?.message?.toLowerCase() ?? "";
    const authAlreadyExists =
      authMessage.includes("already") ||
      authMessage.includes("registered") ||
      authError?.status === 422;

    if (authError && !authAlreadyExists) {
      return NextResponse.json(
        { error: mapErrorToPtBr(authError?.message) },
        { status: 500 }
      );
    }

    const { data, error } = await supabaseServer
      .from("cadastros")
      .upsert({
        name: normalizedName,
        email: normalizedEmail,
        phone: normalizedPhone,
        password_hash: localPasswordHash,
        role: "seguranca",
        active: true,
      }, { onConflict: "email" })
      .select("id, name, email, phone, role, active, created_at")
      .single();

    if (error) {
      return NextResponse.json({ error: mapErrorToPtBr(error.message) }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: data,
    });
  } catch {
    return NextResponse.json(
      { error: "Erro interno ao cadastrar usuário." },
      { status: 500 }
    );
  }
}
