"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Settings } from "lucide-react";
import { useMemo, useSyncExternalStore } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "seguranca";
};

function linkClass(active: boolean): string {
  return active
    ? "text-blue-600 dark:text-blue-400 font-semibold"
    : "text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400";
}

export function AppHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const user = useMemo(() => {
    if (!isClient) return null;
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("authToken");
      return null;
    }
  }, [isClient]);

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("authToken");
    router.replace("/login");
  };

  return (
    <header className="border-b border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/90 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link href="/ponto" className={linkClass(pathname === "/ponto")}>Ponto</Link>
          {user?.role === "admin" && (
            <Link
              href="/admin/relatorios"
              className={linkClass(pathname.startsWith("/admin"))}
            >
              Dashboard/Relatório
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:block text-slate-600 dark:text-slate-300">
            {user?.name ?? "Usuário"}
          </span>

          <details className="relative">
            <summary className="list-none cursor-pointer p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <Settings className="w-5 h-5 text-slate-700 dark:text-slate-200" />
            </summary>
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg p-2 z-50">
              <Link
                href="/configuracoes"
                className="block px-3 py-2 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Editar perfil
              </Link>
              <Link
                href="/configuracoes"
                className="block px-3 py-2 rounded-md text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                Excluir conta
              </Link>
              <button
                onClick={logout}
                className="w-full text-left px-3 py-2 rounded-md text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Sair
              </button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
