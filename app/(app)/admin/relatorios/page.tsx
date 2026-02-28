"use client";

import { useEffect, useState } from "react";

type User = { email: string; role: string };

type Registro = {
  criadoEmIso: string;
  dataLocal: string;
  email: string;
  nome: string;
  tipo: string;
  observacao: string | null;
};

export default function RelatoriosPage() {
  const [user, setUser] = useState<User | null>(null);
  const [targetEmail, setTargetEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [registros, setRegistros] = useState<Registro[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    try {
      setUser(JSON.parse(raw) as User);
    } catch {
      setUser(null);
    }
  }, []);

  const loadRelatorio = async () => {
    if (!user?.email) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ requesterEmail: user.email });
      if (targetEmail) params.set("targetEmail", targetEmail);
      if (from) params.set("from", from);
      if (to) params.set("to", to);

      const response = await fetch(`/api/relatorios?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erro ao carregar relatório.");
        return;
      }

      setRegistros(data.registros ?? []);
    } catch {
      setError("Erro de conexão ao carregar relatório.");
    } finally {
      setLoading(false);
    }
  };

  if (user && user.role !== "admin") {
    return <p className="text-red-600">Acesso permitido apenas para admin.</p>;
  }

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-4">
        <h1 className="text-2xl font-bold">Relatórios</h1>

        <div className="grid gap-3 sm:grid-cols-4">
          <input
            value={targetEmail}
            onChange={(e) => setTargetEmail(e.target.value)}
            placeholder="Email do segurança"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <button
            onClick={loadRelatorio}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Nome</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((item, index) => (
                <tr key={`${item.criadoEmIso}-${index}`} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-3">{item.dataLocal || item.criadoEmIso}</td>
                  <td className="py-2 pr-3">{item.nome}</td>
                  <td className="py-2 pr-3">{item.email}</td>
                  <td className="py-2 pr-3">{item.tipo}</td>
                  <td className="py-2 pr-3">{item.observacao || "-"}</td>
                </tr>
              ))}
              {registros.length === 0 && (
                <tr>
                  <td className="py-3 text-slate-500" colSpan={5}>
                    Nenhum resultado.
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
