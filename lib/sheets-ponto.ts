import { createPrivateKey, createSign } from "node:crypto";

export type PontoTipo = "entrada" | "inicio_descanso" | "fim_descanso" | "saida";

export interface PontoRegistro {
  criadoEmIso: string;
  dataLocal: string;
  email: string;
  nome: string;
  role: string;
  tipo: PontoTipo;
  latitude: number | null;
  longitude: number | null;
  selfieUrl: string | null;
  observacao: string | null;
}

function base64UrlEncode(value: string | Buffer): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function normalizePrivateKey(rawPrivateKey: string): string {
  let key = rawPrivateKey.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  return key.replace(/\\r/g, "\r").replace(/\\n/g, "\n").trim();
}

async function getGoogleAccessToken(): Promise<string> {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!serviceAccountEmail || !rawPrivateKey) {
    throw new Error(
      "Missing Google service account env vars (GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY)."
    );
  }

  const privateKey = normalizePrivateKey(rawPrivateKey);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccountEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedJwt = `${encodedHeader}.${encodedPayload}`;

  const signer = createSign("RSA-SHA256");
  signer.update(unsignedJwt);

  let signature: Buffer;
  try {
    const privateKeyObject = createPrivateKey({ key: privateKey, format: "pem" });
    signature = signer.sign(privateKeyObject);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY inválida. Na Vercel, salve a chave completa em PEM com \\n (sem truncar)."
    );
  }

  const signedJwt = `${unsignedJwt}.${base64UrlEncode(signature)}`;

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: signedJwt,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await response.json()) as { access_token?: string; error?: string };

  if (!response.ok || !data.access_token) {
    throw new Error(data.error || "Failed to fetch Google access token.");
  }

  return data.access_token;
}

function getSheetsConfig() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_POINTS_TAB_NAME || "Pontos";

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID env var.");
  }

  return { spreadsheetId, tabName };
}

export async function appendPontoRegistro(record: PontoRegistro): Promise<void> {
  const token = await getGoogleAccessToken();
  const { spreadsheetId, tabName } = getSheetsConfig();

  const range = encodeURIComponent(`${tabName}!A:J`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const values = [
    record.criadoEmIso,
    record.dataLocal,
    record.email,
    record.nome,
    record.role,
    record.tipo,
    record.latitude ?? "",
    record.longitude ?? "",
    record.selfieUrl ?? "",
    record.observacao ?? "",
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Failed to append row on Google Sheets.");
  }
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function listPontoRegistros(): Promise<PontoRegistro[]> {
  const token = await getGoogleAccessToken();
  const { spreadsheetId, tabName } = getSheetsConfig();

  const range = encodeURIComponent(`${tabName}!A2:J`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;

  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await response.json()) as { values?: string[][]; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(data.error?.message || "Failed to list rows from Google Sheets.");
  }

  const rows = data.values ?? [];

  return rows
    .map((row) => ({
      criadoEmIso: row[0] || "",
      dataLocal: row[1] || "",
      email: (row[2] || "").toLowerCase(),
      nome: row[3] || "",
      role: row[4] || "",
      tipo: (row[5] as PontoTipo) || "entrada",
      latitude: parseNumber(row[6]),
      longitude: parseNumber(row[7]),
      selfieUrl: row[8] || null,
      observacao: row[9] || null,
    }))
    .filter((item) => item.criadoEmIso && item.email && item.tipo);
}
