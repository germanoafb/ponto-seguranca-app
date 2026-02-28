import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

const MAX_SELFIE_BYTES = 2 * 1024 * 1024;

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function parseDataUrl(
  dataUrl: string
): { contentType: string; bytes: Uint8Array; extension: string } | null {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;

  const contentType = match[1];
  const base64Data = match[2];
  const bytes = decodeBase64(base64Data);

  const extensionMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const extension = extensionMap[contentType] || "jpg";
  return { contentType, bytes, extension };
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

    if (parsed.bytes.byteLength > MAX_SELFIE_BYTES) {
      return NextResponse.json(
        { error: "A selfie excede o tamanho máximo permitido (2MB)." },
        { status: 413 }
      );
    }

    const bucket = process.env.SUPABASE_SELFIE_BUCKET || "selfies-ponto";
    const safeEmail = String(email).trim().toLowerCase().replace(/[^a-z0-9@._-]/g, "");
    const filePath = `${safeEmail}/${Date.now()}-${Math.random().toString(36).slice(2)}.${parsed.extension}`;

    const { error: uploadError } = await supabaseServer.storage
      .from(bucket)
      .upload(filePath, parsed.bytes, {
        contentType: parsed.contentType,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabaseServer.storage.from(bucket).getPublicUrl(filePath);

    return NextResponse.json({ success: true, selfieUrl: data.publicUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno ao enviar selfie.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
