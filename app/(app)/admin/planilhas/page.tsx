"use client";

import { useEffect, useState } from "react";

type User = { email: string; role: string };

type Funcao = "seguranca" | "bombeiro_civil";

const ENDERECO_TITAS = "Rua - Dr. Antônio Rodrigues Braga,118 - São Sebastião - Uberaba/MG";

export default function CriarPlanilhasPage() {
  const [user, setUser] = useState<User | null>(null);
  const [cnpj, setCnpj] = useState("");
  const [contratante, setContratante] = useState("");
  const [contratada, setContratada] = useState("TITÃS PRESTADORA DE SERVIÇOS LTDA");
  const [mesAno, setMesAno] = useState("");
  const [enderecoContratante, setEnderecoContratante] = useState("");
  const [nomeColaborador, setNomeColaborador] = useState("");
  const [funcao, setFuncao] = useState<Funcao>("seguranca");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;

    try {
      setUser(JSON.parse(raw) as User);
    } catch {
      setUser(null);
    }
  }, []);

  const gerarPlanilha = async () => {
    if (!user?.email) return;

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/planilhas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requesterEmail: user.email,
          cnpj,
          contratante,
          contratada,
          mesAno,
          enderecoTitas: ENDERECO_TITAS,
          enderecoContratante,
          nomeColaborador,
          funcao,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        setError(payload?.error || "Erro ao gerar planilha.");
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `folha-ponto-${(mesAno || new Date().toISOString().slice(0, 7)).replace("/", "-")}.xlsx`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setError("Erro de conexão ao gerar planilha.");
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
        <h1 className="text-2xl font-bold">Criar Planilha</h1>

        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="CNPJ (ex.: 00.000.000/0000-00)"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            value={contratante}
            onChange={(e) => setContratante(e.target.value)}
            placeholder="Contratante"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            value={contratada}
            onChange={(e) => setContratada(e.target.value)}
            placeholder="Contratada"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            type="month"
            value={mesAno}
            onChange={(e) => setMesAno(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            value={ENDERECO_TITAS}
            disabled
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200"
          />
          <input
            value={enderecoContratante}
            onChange={(e) => setEnderecoContratante(e.target.value)}
            placeholder="Endereço da contratante"
            className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <input
            value={nomeColaborador}
            onChange={(e) => setNomeColaborador(e.target.value)}
            placeholder="Nome do colaborador"
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          />
          <select
            value={funcao}
            onChange={(e) => setFuncao(e.target.value as Funcao)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
          >
            <option value="seguranca">Segurança</option>
            <option value="bombeiro_civil">Bombeiro Civil</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={gerarPlanilha}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
        >
          {loading ? "Gerando..." : "Gerar planilha (.xlsx)"}
        </button>
      </section>
    </div>
  );
}
