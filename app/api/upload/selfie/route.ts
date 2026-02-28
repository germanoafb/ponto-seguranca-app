import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";

function parseDataUrl(dataUrl: string): { contentType: string; buffer: Buffer; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const contentType = match[1];
  const base64Data = match[2];
  const buffer = Buffer.from(base64Data, "base64");

  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extensionMap[contentType] || "jpg";
  return { contentType, buffer, extension };
}

export async function POST(request: NextRequest) {
  try {
    const { email, selfieDataUrl }: { email?: string; selfieDataUrl?: string } = await request.json();

    if (!email || !selfieDataUrl) {
      return NextResponse.json(
        { error: "Email e selfieDataUrl são obrigatórios." },
        { status: 400 }
      );
    }

    const parsed = parseDataUrl(String(selfieDataUrl));
    if (!parsed) {
      return NextResponse.json({ error: "Formato da selfie inválido." }, { status: 400 });
    }

    const bucket = process.env.SUPABASE_SELFIE_BUCKET || "selfies-ponto";
    const safeEmail = String(email).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "");
    const filePath = `${safeEmail}/${Date.now()}-${Math.random().toString(36).slice(2)}.${parsed.extension}`;

    const { error: uploadError } = await supabaseServer.storage
      .from(bucket)
      .upload(filePath, parsed.buffer, {
        contentType: parsed.contentType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabaseServer.storage.from(bucket).getPublicUrl(filePath);

    return NextResponse.json({ success: true, selfieUrl: data.publicUrl });
  } catch {
    return NextResponse.json({ error: "Erro interno ao enviar selfie." }, { status: 500 });
  }
}
