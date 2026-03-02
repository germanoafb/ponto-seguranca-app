import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";

export const runtime = "nodejs";

const DEFAULT_RETENTION_DAYS = 60;
const BATCH_SIZE = 500;

type PontoSelfieRow = {
  id: string;
  selfie_url: string | null;
};

function getRetentionDays(): number {
  const raw = process.env.SELFIE_RETENTION_DAYS;
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_RETENTION_DAYS;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_RETENTION_DAYS;
  return parsed;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  if (!auth) return false;

  return auth === `Bearer ${secret}`;
}

function extractStoragePathFromPublicUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/object/public/${bucket}/`;
    const index = parsed.pathname.indexOf(marker);

    if (index < 0) return null;

    const encodedPath = parsed.pathname.slice(index + marker.length);
    if (!encodedPath) return null;

    return decodeURIComponent(encodedPath);
  } catch {
    return null;
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const retentionDays = getRetentionDays();
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const cutoffIso = cutoff.toISOString();
    const bucket = process.env.SUPABASE_SELFIE_BUCKET || "selfies-ponto";

    let totalRows = 0;
    let totalUrls = 0;
    let totalDeletedFiles = 0;
    let totalClearedRows = 0;
    let skippedInvalidUrl = 0;

    while (true) {
      const { data: rows, error: selectError } = await supabaseServer
        .from("pontos")
        .select("id, selfie_url")
        .not("selfie_url", "is", null)
        .lt("created_at", cutoffIso)
        .order("created_at", { ascending: true })
        .limit(BATCH_SIZE);

      if (selectError) {
        throw new Error(selectError.message || "Erro ao buscar selfies antigas.");
      }

      const batch = (rows ?? []) as PontoSelfieRow[];
      if (batch.length === 0) break;

      totalRows += batch.length;

      const idsToClear: string[] = [];
      const pathsToDelete: string[] = [];

      for (const row of batch) {
        idsToClear.push(row.id);

        const url = row.selfie_url?.trim();
        if (!url) continue;

        totalUrls += 1;
        const path = extractStoragePathFromPublicUrl(url, bucket);
        if (!path) {
          skippedInvalidUrl += 1;
          continue;
        }

        pathsToDelete.push(path);
      }

      for (const deleteChunk of chunk(pathsToDelete, 100)) {
        if (deleteChunk.length === 0) continue;
        const { error: removeError } = await supabaseServer.storage.from(bucket).remove(deleteChunk);
        if (removeError) {
          throw new Error(removeError.message || "Erro ao remover arquivos antigos.");
        }
        totalDeletedFiles += deleteChunk.length;
      }

      const { error: updateError } = await supabaseServer
        .from("pontos")
        .update({ selfie_url: null })
        .in("id", idsToClear);

      if (updateError) {
        throw new Error(updateError.message || "Erro ao limpar referência de selfie.");
      }

      totalClearedRows += idsToClear.length;
    }

    return NextResponse.json({
      success: true,
      retentionDays,
      cutoffIso,
      totalRows,
      totalUrls,
      totalDeletedFiles,
      totalClearedRows,
      skippedInvalidUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro ao executar limpeza de selfies." },
      { status: 500 }
    );
  }
}
