"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  });
  const [name, setName] = useState(() => user?.name ?? "");
  const [email, setEmail] = useState(() => user?.email ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePerfil = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    setSuccess("");

    if (password && password !== confirmPassword) {
      setLoading(false);
      setError("Senha e confirmação não conferem.");
      return;
    }

    const response = await fetch("/api/auth/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentEmail: user.email,
        name,
        email,
        password: password || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setLoading(false);
      setError(data.error || "Erro ao atualizar perfil.");
      return;
    }

    const updatedUser: User = {
      ...user,
      name: data.user.name,
      email: data.user.email,
    };

    localStorage.setItem("user", JSON.stringify(updatedUser));
    setUser(updatedUser);
    setPassword("");
    setConfirmPassword("");
    setSuccess("Perfil atualizado com sucesso.");
    setLoading(false);
  };

  const excluirConta = async () => {
    if (!user) return;
    const ok = window.confirm("Tem certeza que deseja excluir sua conta?");
    if (!ok) return;

    const response = await fetch("/api/auth/profile", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Erro ao excluir conta.");
      return;
    }

    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    router.replace("/login");
  };

  const sair = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    router.replace("/login");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-5 space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Nova senha (opcional)"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        />
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirmar nova senha"
          className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
        />

        <div className="flex gap-2">
          <button
            onClick={updatePerfil}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
          >
            Salvar perfil
          </button>
          <button
            onClick={sair}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700"
          >
            Sair
          </button>
          <button
            onClick={excluirConta}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
          >
            Excluir conta
          </button>
        </div>
      </section>
    </div>
  );
}
