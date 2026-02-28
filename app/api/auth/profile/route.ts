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

export async function PUT(request: NextRequest) {
  try {
    const { currentEmail, name, email, password } = await request.json();

    if (!currentEmail || !name || !email) {
      return NextResponse.json(
        { error: "currentEmail, name e email são obrigatórios." },
        { status: 400 }
      );
    }

    const current = String(currentEmail).trim().toLowerCase();
    const nextEmail = String(email).trim().toLowerCase();
    const nextName = String(name).trim();

    if (password && !isPasswordStrong(String(password))) {
      return NextResponse.json(
        { error: "Senha fora da política de segurança." },
        { status: 400 }
      );
    }

    if (nextEmail !== current) {
      const { data: existing } = await supabaseServer
        .from("cadastros")
        .select("id")
        .eq("email", nextEmail)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: "Email já está em uso." }, { status: 409 });
      }
    }

    const updatePayload: {
      name: string;
      email: string;
      password_hash?: string;
    } = {
      name: nextName,
      email: nextEmail,
    };

    if (password) {
      updatePayload.password_hash = hashPassword(String(password));
    }

    const { data, error } = await supabaseServer
      .from("cadastros")
      .update(updatePayload)
      .eq("email", current)
      .select("id, name, email, role, active")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: data });
  } catch {
    return NextResponse.json({ error: "Erro interno ao atualizar perfil." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório." }, { status: 400 });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const { error } = await supabaseServer.from("cadastros").delete().eq("email", normalizedEmail);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erro interno ao excluir conta." }, { status: 500 });
  }
}
