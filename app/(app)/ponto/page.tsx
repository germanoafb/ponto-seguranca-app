"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentLocation } from "../../../lib/geolocation";
import CameraCapture from "../../../components/CameraCapture";
import { formatDateTimeBr } from "../../../lib/datetime";

type PontoTipo = "entrada" | "inicio_descanso" | "fim_descanso" | "saida";

type User = { email: string; name: string; role: string };

type Registro = {
  criadoEmIso: string;
  dataLocal: string;
  tipo: PontoTipo;
  observacao: string | null;
};

const TIPOS: { value: PontoTipo; label: string }[] = [
  { value: "entrada", label: "Entrada" },
  { value: "inicio_descanso", label: "Início descanso" },
  { value: "fim_descanso", label: "Fim descanso" },
  { value: "saida", label: "Saída" },
];

export default function PontoPage() {
  const [user, setUser] = useState<User | null>(null);
  const [tipo, setTipo] = useState<PontoTipo>("entrada");
  const [observacao, setObservacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    try {
      setUser(JSON.parse(raw) as User);
    } catch {
      setUser(null);
    }
  }, []);

  const canRegister = useMemo(() => !!user?.email, [user]);

  const loadRegistros = async (email: string) => {
    const response = await fetch(`/api/ponto?email=${encodeURIComponent(email)}`);
    const data = await response.json();
    if (response.ok) {
      setRegistros(data.registros ?? []);
    }
  };

  useEffect(() => {
    if (user?.email) {
      loadRegistros(user.email);
    }
  }, [user?.email]);

  const baterPonto = async () => {
    if (!user?.email) return;
    if (!selfieDataUrl) {
      setError("A selfie é obrigatória para registrar o ponto.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const location = await getCurrentLocation().catch(() => null);
      const uploadResponse = await fetch("/api/upload/selfie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          selfieDataUrl,
        }),
      });

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok || !uploadData?.selfieUrl) {
        setError(uploadData.error || "Erro ao enviar selfie.");
        return;
      }

      const response = await fetch("/api/ponto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          tipo,
          latitude: location?.latitude,
          longitude: location?.longitude,
          selfieUrl: uploadData.selfieUrl,
          observacao: observacao || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao registrar ponto.");
        return;
      }

      setSuccess("Ponto registrado com sucesso.");
      setObservacao("");
      setSelfieDataUrl(null);
      await loadRegistros(user.email);
    } catch {
      setError("Erro de conexão ao registrar ponto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
        <h1 className="text-2xl font-bold">Bater ponto</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Regras: descanso mínimo de 20 minutos entre início e fim do descanso.
        </p>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {success && <div className="text-sm text-green-600">{success}</div>}

        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as PontoTipo)}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            {TIPOS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>

          <input
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação (opcional)"
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
        </div>

        <CameraCapture selfieDataUrl={selfieDataUrl} onChange={setSelfieDataUrl} />

        <button
          onClick={baterPonto}
          disabled={!canRegister || loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Registrar ponto"}
        </button>
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-3">Últimos registros</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((registro, index) => (
                <tr key={`${registro.criadoEmIso}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">{registro.dataLocal || formatDateTimeBr(registro.criadoEmIso)}</td>
                  <td className="py-2 pr-3">{registro.tipo}</td>
                  <td className="py-2 pr-3">{registro.observacao || "-"}</td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={3}>
                    Nenhum registro encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
