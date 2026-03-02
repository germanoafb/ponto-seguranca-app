import { supabaseServer } from "./supabase-server";

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

type PontoRow = {
  created_at: string;
  data_local: string | null;
  email: string;
  nome: string;
  role: string;
  tipo: PontoTipo;
  latitude: number | null;
  longitude: number | null;
  selfie_url: string | null;
  observacao: string | null;
};

type ListPontoFilters = {
  email?: string;
  fromIso?: string | null;
  toIso?: string | null;
  query?: string;
};

function mapRowToRegistro(row: PontoRow): PontoRegistro {
  return {
    criadoEmIso: row.created_at,
    dataLocal: row.data_local || "",
    email: row.email,
    nome: row.nome,
    role: row.role,
    tipo: row.tipo,
    latitude: row.latitude,
    longitude: row.longitude,
    selfieUrl: row.selfie_url,
    observacao: row.observacao,
  };
}

export async function createPontoRegistro(record: PontoRegistro): Promise<void> {
  const payload = {
    created_at: record.criadoEmIso,
    data_local: record.dataLocal,
    email: record.email.trim().toLowerCase(),
    nome: record.nome,
    role: record.role,
    tipo: record.tipo,
    latitude: record.latitude,
    longitude: record.longitude,
    selfie_url: record.selfieUrl,
    observacao: record.observacao,
  };

  const { error } = await supabaseServer.from("pontos").insert(payload);

  if (error) {
    throw new Error(error.message || "Erro ao registrar ponto no banco.");
  }
}

export async function listPontoRegistros(filters: ListPontoFilters = {}): Promise<PontoRegistro[]> {
  let queryBuilder = supabaseServer
    .from("pontos")
    .select(
      "created_at, data_local, email, nome, role, tipo, latitude, longitude, selfie_url, observacao"
    )
    .order("created_at", { ascending: false });

  if (filters.email) {
    queryBuilder = queryBuilder.eq("email", filters.email.trim().toLowerCase());
  }

  if (filters.fromIso) {
    queryBuilder = queryBuilder.gte("created_at", filters.fromIso);
  }

  if (filters.toIso) {
    queryBuilder = queryBuilder.lte("created_at", filters.toIso);
  }

  if (filters.query) {
    const term = filters.query.trim();
    if (term) {
      queryBuilder = queryBuilder.or(`email.ilike.%${term}%,nome.ilike.%${term}%`);
    }
  }

  const { data, error } = await queryBuilder;

  if (error) {
    throw new Error(error.message || "Erro ao listar pontos no banco.");
  }

  return (data as PontoRow[]).map(mapRowToRegistro);
}
